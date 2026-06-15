import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

class FakeClassList {
  toggle() {}
}

class FakeElement {
  constructor() {
    this.innerHTML = "";
    this.textContent = "";
    this.hidden = false;
    this.dataset = {};
    this.classList = new FakeClassList();
  }

  addEventListener() {}
  append() {}
  setAttribute() {}

  querySelector(selector) {
    if (selector === ".quiz-close" || selector === ".quiz-feedback") return new FakeElement();
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function createFakeDocument() {
  const elements = new Map(
    [
      "#last-updated",
      "#score-strip",
      "#standings-body",
      "#goal-standings",
      "#odds-list",
      "#winner-picks",
      "#match-list",
      "#match-filter",
    ].map((selector) => [selector, new FakeElement()]),
  );

  return {
    body: new FakeElement(),
    createElement: () => new FakeElement(),
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: () => [],
    elements,
  };
}

async function waitForRender(document) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.querySelector("#score-strip").innerHTML) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("app render smoke test", () => {
  it("renders content into the score, standings, and matches tabs", async () => {
    const data = JSON.parse(await readFile(new URL("../public/data/world-cup.json", import.meta.url), "utf8"));
    const document = createFakeDocument();

    const previousDocument = globalThis.document;
    const previousFetch = globalThis.fetch;
    const previousNavigator = globalThis.navigator;

    globalThis.document = document;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    try {
      await import(`../src/app.js?render-test=${Date.now()}`);
      await waitForRender(document);

      assert.match(document.querySelector("#score-strip").innerHTML, /score-card/);
      assert.match(document.querySelector("#standings-body").innerHTML, /<tr>/);
      assert.match(document.querySelector("#match-list").innerHTML, /match-card/);
    } finally {
      globalThis.document = previousDocument;
      globalThis.fetch = previousFetch;
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });
    }
  });
});
