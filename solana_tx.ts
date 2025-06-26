import { v4 } from "uuid";
import { requestComputerApi } from '.'
import { getMvmFee } from "./mvm_fee";
import BigNumber from "bignumber.js";
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { buildMixAddress, newMixinInvoice, attachStorageEntry, attachInvoiceEntry, checkSystemCallSize, buildSystemCallExtra, buildComputerExtra, encodeMtgExtra, OperationTypeSystemCall, OperationTypeUserDeposit, userIdToBytes, getInvoiceString } from "@mixin.dev/mixin-node-sdk";

export const sendSolanaTx = async (program_id: string, user_id: string): Promise<string> => {
  // 1. Get the MixAddress of the user which sends the transaction
  const mix = buildMixAddress({
    version: 2,
    uuidMembers: [user_id],
    xinMembers: [],
    threshold: 1
  });

  // 2. Get Nonce Account and computer info
  const computerInfo = await requestComputerApi('GET', '/' , undefined);
  const nonce = await requestComputerApi('POST', '/nonce_accounts', JSON.stringify({mix}));

  // 3. Build the instruction to advance the nonce
  const nonceIns = SystemProgram.nonceAdvance({
    noncePubkey: new PublicKey(nonce.nonce_address),
    authorizedPubkey: new PublicKey(computerInfo.payer)
  });

  // 4. Build solana transaction
  const recipientAddress = new PublicKey(program_id); 
  const txx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(computerInfo.payer),
      toPubkey: recipientAddress,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    })
  );

  // 5. Build the transaction message
  const messageV0 = new TransactionMessage({
    payerKey: new PublicKey(computerInfo.payer),
    recentBlockhash: nonce.nonce_hash,
    instructions: [nonceIns, ...txx.instructions],
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  const txBuf = Buffer.from(tx.serialize(),{
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const valid = checkSystemCallSize(txBuf);
  if (!valid) {
    // ...split to multiple transactions
    // or use Address Lookup Tables, LUTs
  }

  const solAmount = '0.01';
  const fee = await getMvmFee(solAmount)

  // 6. Get the mainnet tx extra
  const user = await requestComputerApi('GET', `/users/${mix}`, undefined);
  const callExtra = buildSystemCallExtra(user_id, v4(), false, fee.fee_id);
  const extra = buildComputerExtra(OperationTypeSystemCall, callExtra);

  // 7. Send the transaction to Computer
  const memo = encodeMtgExtra(computerInfo.members.app_id, extra);

  // 8. Create mixin invoice
  const computer = buildMixAddress({ 
    version: 2,
    xinMembers: [],
    uuidMembers: computerInfo.members.members,
    threshold: computerInfo.members.threshold,
  });
  const invoice = newMixinInvoice(computer);
  if (invoice === undefined) {
    return;
  }
  // 9. Store Solana tx to Mixin Storage
  attachStorageEntry(invoice, v4(), txBuf);

  // 10. Encode the memo and attach it to the invoice
  const referenceExtra = Buffer.from(
    encodeMtgExtra(computerInfo.value.members.app_id, buildComputerExtra(OperationTypeUserDeposit, userIdToBytes(user.value.info.id))),
  );

  // 11. Attach the invoice entries
  attachInvoiceEntry(invoice, {
    trace_id: v4(),
    asset_id: "c6d0c728-2624-429b-8e0d-d9d19b6592fa", // BTC
    amount: "0.01",
    extra: referenceExtra,
    index_references: [],
    hash_references: []
  });
  attachInvoiceEntry(invoice, {
    trace_id: v4(),
    asset_id: "64692c23-8971-4cf4-84a7-4dd1271dd887", // SOL
    amount: "0.01",
    extra: referenceExtra,
    index_references: [],
    hash_references: []
  });

  // 12. Create transaction fee = 0.001 XIN + extra program invoke fee
  // fee_id would expire, need to pay in time
  let total = BigNumber(computerInfo.params.operation.price).plus(fee.xin_amount).toFixed(8, BigNumber.ROUND_CEIL);
  attachInvoiceEntry(invoice, {
    trace_id: v4(),
    asset_id: "c94ac88f-4671-3976-b60a-09064f1811e8", // XIN
    amount: total,
    extra: Buffer.from(memo),
    index_references: [0, 1], // Use the invoice entry before
    hash_references: []
  });

  const codeUrl = 'https://mixin.one/pay/' + getInvoiceString(invoice);
  return codeUrl;
}