import { requestComputerApi } from ".";
import { encodeMtgExtra } from "@mixin.dev/mixin-node-sdk";
import { buildMixAddress, buildComputerExtra, OperationTypeAddUser } from "@mixin.dev/mixin-node-sdk";

const registerUser = async (user_id: string) => {
  // 1. Get the MixAddress of the user
  const mix = buildMixAddress({
    version: 2,
    uuidMembers: [user_id],
    xinMembers: [],
    threshold: 1
  });
  console.log(`mix: ${mix}`);

  // 2. Build the computer extra with the OperationTypeAddUser and the MixAddress
  const extra = buildComputerExtra(OperationTypeAddUser, Buffer.from(mix));
  console.log(`extra: ${extra.toString('hex')}`);

  // 3. Request the computer API to get mainnet transaction memo
  const computerInfo = await requestComputerApi('GET', '/' , undefined);
  const memo = encodeMtgExtra(computerInfo.members.app_id, extra);
  console.log(`memo: ${memo}`);

  // 4. Get the MixAddress of the computer MTG
  const destination = buildMixAddress({ 
    version: 2,
    xinMembers: [],
    uuidMembers: computerInfo.members.members,
    threshold: computerInfo.members.threshold,
  });

  // 5. Build the code URL for payment
  let codeUrl = `https://mixin.one/pay/${destination}?amount=${computerInfo.params.operation.price}&memo=${memo}`
  console.log(`codeUrl: ${codeUrl}`);
}

registerUser('c3f8b0d2-1e4a-4f5b-9c6d-7e8f9a0b1c2d') // Replace with the actual user_id