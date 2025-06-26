// Use MVM endpoints to get the fee for a transaction
import { requestComputerApi } from ".";

export const getMvmFee = async (solAmount: string) => {
  const fee = await requestComputerApi('POST', '/fee' , JSON.stringify({ sol_amount: solAmount }));
  console.log(`MVM XIN fee for ${solAmount} SOL:`, fee);
  return fee;
}
