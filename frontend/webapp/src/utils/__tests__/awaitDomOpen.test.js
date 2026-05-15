import { awaitDomOpen } from "../awaitDomOpen";

describe("awaitDomOpen", () => {
  test("resolves when target element gains the open class", async () => {
    document.body.innerHTML = `
      <div textid="lehites/1"><a class="reference"></a></div>
    `;
    const promise = awaitDomOpen("lehites/1", 500);
    setTimeout(() => {
      document.querySelector("[textid='lehites/1'] .reference").classList.add("open");
    }, 50);
    await expect(promise).resolves.toBe("opened");
  });

  test("resolves with 'timeout' when class never appears", async () => {
    document.body.innerHTML = `
      <div textid="lehites/1"><a class="reference"></a></div>
    `;
    await expect(awaitDomOpen("lehites/1", 100)).resolves.toBe("timeout");
  });

  test("resolves with 'missing' when element doesn't exist", async () => {
    document.body.innerHTML = ``;
    await expect(awaitDomOpen("lehites/missing", 100)).resolves.toBe("missing");
  });
});
