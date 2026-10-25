import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { createDevReview } = createRequire(import.meta.url)(
  "../electron/dev-review.cjs",
);

// Never populate a review code, even a synthetic one. Only the human tester does that.
test("DEV review starts empty and omits review header; clearing stays empty", () => {
  const review = createDevReview();
  assert.equal(review.get(), "");
  assert.deepEqual(review.headers(), {
    "X-Haspataal-Developer": "mkashif",
    "X-Haspataal-Implementation": "1",
  });
  review.set("");
  assert.equal(review.get(), "");
  assert.equal(Object.hasOwn(review.headers(), "X-Haspataal-Review"), false);
  assert.equal(createDevReview().get(), "");
});
