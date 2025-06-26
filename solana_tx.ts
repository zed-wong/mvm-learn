import { v4 } from "uuid";
import { requestComputerApi } from '.'
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { buildMixAddress, newMixinInvoice, attachStorageEntry, attachInvoiceEntry, checkSystemCallSize, buildSystemCallExtra, buildComputerExtra, encodeMtgExtra, OperationTypeSystemCall, OperationTypeUserDeposit, userIdToBytes } from "@mixin.dev/mixin-node-sdk";

// 第一步先通过 Computer Http Api 获取可用的 Nonce Account 和交易的 Payer 地址。
// 通过 Computer 执行的 Solana 交易，必须用 Nonce Account Hash 作为 Recent Block Hash，
// 且其第一个 Instruction 必须为 NonceAdvance。Payer 只可作为交易的 Fee Payer，
// 不可在 NonceAdvance 之后的 instruction 中操作。
// 一个 Nonce Account 仅能用于发一笔交易，如果您需要发多笔交易请获取多个 Nonce Account。

const sendSolanaTx = async (program_id: string, user_id: string) => {
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
  // fee_id 具有实效性，须尽快支付
  let total = BigNumber(computerInfo.params.operation.price).plus(fee.xin_amount).toFixed(8, BigNumber.ROUND_CEIL);
  attachInvoiceEntry(invoice, {
    trace_id: v4(),
    asset_id: "c94ac88f-4671-3976-b60a-09064f1811e8", // XIN
    amount: total,
    extra: Buffer.from(memo),
    index_references: [0, 1], // 引用前面的 invoice entry
    hash_references: []
  });
}



// 2 | UID (8 bytes) | CID (uuid) | SKIP_POSTPROCESS_FLAG (1 byte) | FEE_ID (uuid, optional)