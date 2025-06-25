export const requestComputerApi = async (method: string, url: string, body: unknown) => {
  const resp = await fetch('https://computer.mixin.dev' + url, { method, body });
  const data = await resp.text();
  return JSON.parse(data)
};

const main = () => {

}