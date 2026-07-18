// scripts/run-reconciler.js
const config = require('../src/config');
const { pool } = require('../src/db/pool');
const jobLockService = require('../src/services/jobLockService');
const circuitBreakerService = require('../src/services/circuitBreakerService');
const chapaClient = require('../src/clients/chapaClient');
const txnRepo = require('../src/repositories/transactionRepo');
const recoveryService = require('../src/services/recoveryService');
const deliveryQueueService = require('../src/services/deliveryQueueService');

const JOB_NAME = 'reconciler';

async function sweepForwarding() {
  const rows = await txnRepo.getStaleForwarding(config.reconciler.forwardingStaleMinutes);
  console.log(`FORWARDING sweep: ${rows.length} stale row(s).`);
  for (const row of rows) {
    const claimed = await txnRepo.claimForRecovery(row.app_id, row.client_order_id);
    if (!claimed) {
      console.log(`  tx id=${row.id} already claimed by a live request, skipping`);
      continue;
    }
    const freshRow = await txnRepo.getById(row.id);
    try {
      await recoveryService.runRecoveryAsWinner(row.app_id, freshRow);
      console.log(`  resolved tx id=${row.id}`);
    } catch (err) {
      console.log(`  still unresolved tx id=${row.id}: ${err.message}`);
    }
  }
}

async function sweepRecovering() {
  const rows = await txnRepo.getStaleRecovering(config.reconciler.recoveringStaleSeconds);
  console.log(`RECOVERING sweep: ${rows.length} stale row(s).`);
  for (const row of rows) {
    const reclaimed = await txnRepo.reclaimStaleRecovering(
      row.id,
      config.reconciler.recoveringStaleSeconds
    );
    if (!reclaimed) {
      console.log(`  tx id=${row.id} already reclaimed by another runner, skipping`);
      continue;
    }
    const freshRow = await txnRepo.getById(row.id);
    try {
      await recoveryService.runRecoveryAsWinner(row.app_id, freshRow);
      console.log(`  resolved tx id=${row.id}`);
    } catch (err) {
      console.log(`  still unresolved tx id=${row.id}: ${err.message}`);
    }
  }
}

async function sweepInitialized() {
  const rows = await txnRepo.getStaleInitialized(config.reconciler.initializedStaleMinutes);
  console.log(`INITIALIZED sweep: ${rows.length} stale row(s).`);
  for (const row of rows) {
    let verifyResult;
    try {
      verifyResult = await chapaClient.verifyTransaction(row.chapa_tx_ref);
    } catch (err) {
      console.log(`  verify failed for tx id=${row.id}: ${err.message}`);
      continue;
    }

    if (verifyResult.notFound) {
      console.log(`  tx id=${row.id} still genuinely pending on gateway`);
      continue;
    }

    if (verifyResult.found && verifyResult.paymentStatus === 'success') {
      const updated = await txnRepo.markPaidIfStillInitialized(row.id, verifyResult.raw);
      if (updated) {
        await deliveryQueueService.enqueueDelivery({
          txRef: row.chapa_tx_ref,
          eventType: 'payment.success',
          appId: row.app_id,
          payload: {
            tx_ref: row.chapa_tx_ref,
            client_order_id: row.client_order_id,
            status: 'success',
            amount: row.amount,
            currency: row.currency,
          },
        });
        console.log(`  tx id=${row.id} -> PAID (recovered via reconciler)`);
      } else {
        console.log(`  tx id=${row.id} already resolved elsewhere (e.g. a webhook), skipping`);
      }
    } else {
      const updated = await txnRepo.markFailedIfStillInitialized(row.id, verifyResult.raw);
      if (updated) {
        await deliveryQueueService.enqueueDelivery({
          txRef: row.chapa_tx_ref,
          eventType: 'payment.failed',
          appId: row.app_id,
          payload: {
            tx_ref: row.chapa_tx_ref,
            client_order_id: row.client_order_id,
            status: 'failed',
            amount: row.amount,
            currency: row.currency,
          },
        });
        console.log(`  tx id=${row.id} -> FAILED (recovered via reconciler)`);
      }
    }
  }
}

async function sweepSuperseded() {
  const rows = await txnRepo.getUnresolvedSuperseded();
  console.log(`SUPERSEDED sweep: ${rows.length} row(s).`);
  for (const row of rows) {
    let verifyResult;
    try {
      verifyResult = await chapaClient.verifyTransaction(row.chapa_tx_ref);
    } catch (err) {
      console.log(`  verify failed for tx id=${row.id}: ${err.message}`);
      continue;
    }

    if (verifyResult.notFound) {
      await txnRepo.markAbortedIfSuperseded(row.id);
      console.log(`  tx id=${row.id} -> ABORTED (confirmed never existed on gateway)`);
    } else {
      await txnRepo.annotateConfirmedOrphan(row.id, verifyResult.raw);
      console.log(`  tx id=${row.id} confirmed still orphaned on gateway, annotated`);
    }
  }
}

async function run() {
  const acquired = await jobLockService.acquireLock(JOB_NAME);
  if (!acquired) {
    console.log('Lock not acquired for reconciler, another run is in progress. Exiting.');
    return;
  }

  try {
    const status = await circuitBreakerService.readStatus();
    let actingAsProbe = false;

    if (status.chapa_status === 'DEGRADED') {
      actingAsProbe = await circuitBreakerService.attemptProbeClaim();
      if (!actingAsProbe) {
        console.log('Circuit breaker DEGRADED, cooldown not yet elapsed. Skipping this run.');
        return;
      }
      console.log('Cooldown elapsed — this reconciler run is acting as the probe.');
    } else if (status.chapa_status === 'PROBING') {
      actingAsProbe = await circuitBreakerService.reclaimStaleProbe();
      if (!actingAsProbe) {
        console.log('Circuit breaker PROBING, not stale. Skipping this run.');
        return;
      }
      console.log('Reclaimed a stale probe — this reconciler run is acting as the probe.');
    }

    let sweepFailed = false;
    try {
      await sweepForwarding();
      await sweepRecovering();
      await sweepInitialized();
      await sweepSuperseded();
    } catch (err) {
      sweepFailed = true;
      console.error('Reconciler sweep encountered an unexpected error:', err.message);
    }

    if (actingAsProbe) {
      await circuitBreakerService.resolveProbe(!sweepFailed);
    }
  } finally {
    await jobLockService.releaseLock(JOB_NAME);
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Reconciler failed:', err);
  process.exit(1);
});
