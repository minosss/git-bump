# git-bump [![v](https://img.shields.io/npm/v/@yme/git-bump?color=5755d9&label=)](https://www.npmjs.com/package/@yme/git-bump)

tired of update package version. NO options here, you should know what you did, If you make a mistake, learn and fix it.

Install

```sh
pnpm -g add @yme/git-bump
```

Usage

```
# git bump

git bump [options] [release]

# use server, default is patch
git bump [major, premajor, minor, preminor, patch, prepatch, prerelease]

# custom version
git bump v1.2.3

Options

--help			print this usage information
--dry			run dry mode
--commit		commit all changeds default is true
--message=		commit message, default is chore(release): v__VERSION__
--tag			create a new tag, default is true
--packages=		workspace packages, default is packages

```
