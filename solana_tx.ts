import { requestComputerApi } from '.'
import { buildMixAddress } from '@mixin.dev/mixin-node-sdk';
import { checkSystemCallSize } from "@mixin.dev/mixin-node-sdk";
import { PublicKey, VersionedTransaction, TransactionMessage, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

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

}