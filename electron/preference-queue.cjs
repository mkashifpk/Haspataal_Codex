// Resolve relative changes only when the preceding save has completed. The
// context guard prevents queued changes from crossing a sign-out/sign-in.
function createPreferenceQueue({ read, write, context }) {
  let tail = Promise.resolve();
  return (change) => {
    const owner = context();
    const task = tail.then(() => {
      if (owner !== context())
        throw new Error("The session changed. Try again.");
      const value = typeof change === "function" ? change(read()) : change;
      return write({ ...value }, owner);
    });
    tail = task.catch(() => {});
    return task;
  };
}
module.exports = { createPreferenceQueue };
