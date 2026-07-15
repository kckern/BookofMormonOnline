import {
  indexPageComments,
  addToPageCommentIndex,
  updateToPageComment,
  deleteToPageComments,
} from "../commentIndex";

const msg = (links, id = "m1") => ({
  messageId: id,
  data: JSON.stringify({ links }),
});

test("indexPageComments buckets messages by link type and id", () => {
  const index = indexPageComments([msg({ text: 3 }), msg({ img: 101, text: 4 }, "m2")]);
  expect(index.text[3].messageId).toBe("m1");
  expect(index.text[4].messageId).toBe("m2");
  expect(index.img[101].messageId).toBe("m2");
});

test("indexPageComments skips non-JSON and link-less messages", () => {
  const index = indexPageComments([
    { data: "not json" },
    { data: JSON.stringify({ noLinks: true }) },
    msg({ text: 1 }),
  ]);
  expect(Object.keys(index)).toEqual(["text"]);
});

test("addToPageCommentIndex creates buckets and sets the item", () => {
  const out = addToPageCommentIndex(null, msg({ fax: "3.1830" }));
  expect(out.fax["3.1830"].messageId).toBe("m1");
});

test("updateToPageComment does not throw when the bucket is missing", () => {
  const out = updateToPageComment({}, msg({ text: 9 }));
  expect(out.text[9].messageId).toBe("m1");
});

test("deleteToPageComments removes the entry entirely", () => {
  const index = indexPageComments([msg({ text: 3 })]);
  const out = deleteToPageComments(index, msg({ text: 3 }));
  expect(out.text[3]).toBeUndefined(); // was a truthy [] before the fix
});

test("delete/update tolerate garbage data", () => {
  expect(deleteToPageComments({ a: {} }, { data: "x" })).toEqual({ a: {} });
  expect(updateToPageComment({ a: {} }, { data: "x" })).toEqual({ a: {} });
});

test("add/update/delete do not mutate the input index (copy-on-write)", () => {
  const before = indexPageComments([msg({ text: 3 })]);
  const beforeTextBucket = before.text;
  const added = addToPageCommentIndex(before, msg({ text: 4 }, "m2"));
  expect(before.text[4]).toBeUndefined();       // input untouched
  expect(added).not.toBe(before);               // new top-level object
  expect(added.text).not.toBe(beforeTextBucket); // touched bucket copied
  const deleted = deleteToPageComments(added, msg({ text: 3 }));
  expect(added.text[3]).toBeDefined();          // input untouched
  expect(deleted.text[3]).toBeUndefined();
});
