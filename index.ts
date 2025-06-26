import { checkUserRegistered, registerUser } from "./register_user";
import { sendSolanaTx } from "./solana_tx";

export const requestComputerApi = async (method: string, url: string, body: unknown) => {
  const resp = await fetch('https://computer.mixin.dev' + url, { method, body });
  const data = await resp.text();
  return JSON.parse(data)
};

const main = async () => {
  const program_id = '' // solana program id
  const user_id = ''; // mixin user id
  
  // 1. register user if not registered
  if (!await checkUserRegistered(user_id)) {
    const registerCodeUrl = await registerUser(user_id);
    console.log(`Please pay at: ${registerCodeUrl}`);
  }

  // 2. send solana transaction
  const invokeCodeUrl = await sendSolanaTx(program_id, user_id);
  console.log(`Please invoke at: ${invokeCodeUrl}`);
}