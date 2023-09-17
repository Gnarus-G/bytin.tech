---
title: "Solving type safety for .env variables"
description: "Using comments to type environment variables in .env files"
image: "/ntro_thumbnail.png"
video: "https://www.youtube.com/watch?v=OY0eku4SJsE"
---

## Why?

Maybe you know how hard it is to manage your environment variables, especially in a type-safe way.

## Current Solution

You could solve it simply enough with a javascript library like [t3-env](https://github.com/t3-oss/t3-env),
or one you write yourself.

## New solution

But, like, what if you just put, like, jsdoc types in your .env files.
Then, you could parse out a type declaration or [zod](https://github.com/colinhacks/zod) schema
that your environment variables have to respect.
