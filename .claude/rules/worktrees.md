# Worktrees

Plan and build each change in its own git worktree. When the change is
complete, collapse the worktree into `master`. Do this by default. Do
something different only when the user tells you to.

One change, one worktree, one branch.

# Why

Two changes in one worktree share one set of files. When both changes are
half-finished, neither change can run its tests green. A worktree gives each
change its own copy of the files on its own branch. The two changes meet only
at the merge.

# Where a worktree lives

A worktree lives in `.worktrees/<name>`, in this project directory. The name
is the name of the change, in kebab-case. The branch has the same name.

These files tell the tools to ignore `.worktrees`:

- `.gitignore`: git does not show the worktrees as untracked files.
- `vite.config.ts` (`test.exclude`): `pnpm test` in the main worktree does
  not run the tests of another worktree.
- `eslint.config.js` and `.prettierignore`: lint and format do not go into
  the worktrees.

# The steps

1. **Start.** In the main worktree, make the worktree and install the
   packages:

   ```sh
   git worktree add -b <name> .worktrees/<name> master
   pnpm --dir .worktrees/<name> install --frozen-lockfile
   ```

2. **Plan.** If the change needs a plan, write `docs/plans/<name>.md` in the
   worktree. Get the agreement of the user before you build.
3. **Build.** Do all the work in the worktree. Follow
   `.claude/rules/test-driven-development.md`.
4. **Green.** In the worktree, run `pnpm test`, `pnpm lint`, and
   `pnpm build`. All three must pass. Then commit.
5. **Collapse.** In the main worktree, merge the branch into `master`, run
   the checks again, and remove the worktree:

   ```sh
   git -C .worktrees/<name> status --short   # this must print nothing
   git switch master
   git merge --no-ff <name>
   pnpm test && pnpm lint && pnpm build
   git worktree remove .worktrees/<name>
   git branch -d <name>
   ```

   If the checks fail after the merge, stop. Do not leave a red merge on
   `master`. Tell the user.

# When the user says something different

The user can change step 5. For example, "keep the branch", "open a pull
request", or "do not merge". Then do what the user says, and keep the
worktree until the user tells you to remove it.

# Rules

- Do not do two unrelated changes in one worktree.
- Do not merge a worktree when its checks fail.
- Do not leave a worktree after its merge. Remove the worktree and delete the
  branch in the same step.
- A one-line change that you commit at once does not need a worktree.
