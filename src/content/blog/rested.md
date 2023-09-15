---
title: "Better than Postman, better than curl"
description: "Motivation for a DSL Rest Client to replace GUI ones."
---

I started web dev using post man. I mean all the apps I have worked on, I have been fullstack; but whenever I could not just call the api from the UI code
while developing, check the network tab ect..; I would use postman. I was never a power user of postman, never paid, never did load testing or anything like that. I went as
far as using environment variables, and graphql.

At some point, I skilled up and started using Vim motions - shout out Ben Awad for the video that convinced me to do so. Later, I started using neovim. I use neovim, btw.
From when I picked up nvim, for about a year, I was only doing UI dev. I got used to, and loved, staying in the terminal to get work done. I gradually developed a small disdain for GUIs
, especially when the problem could be so easily - or has already been - solved in the terminal with a cli tool.

I returned to fullstack, and started using Postman again. Soon I became very conscious of always having to leave my terminal, move my mouse, and do a few clicks just to basically

```sh
curl https://jsonplaceholder.typicode.com/todos/1
```

Let us face it, I get paid to edit text all day. Naturally, I am learning how to do that as efficiently as possible, hence me learning vim and unix. Most GUIs are not inline with that aim.
Of course Postman has a lot of features `curl` does not, most of witch I do not care about. All I need is curl, and a way to be DRY about common values like authentication tokens
and api origins.

### They so often wondered if they should, that they never pondered if they could.

Would not a custom DSL for defining REST requests be awesome for this, along with a cli and runtime that manage those reusable values as environment variables?
I was already learning about parsers and interpreters, so this seemed doable.

Nevermind Postman, I will just edit a text file; Thanks.
Nevermind curl, I do not like the interface, especially when dealing with json bodies.

I would much rather, just open a file and

```rd
set BASE_URL env("devOrigin")

@log // for printing the response body to stdout
get /users {
  header "Authorization" env("token")
}

//... any other requests can be added to the same file
```

Say the file is `.api.rd`, you can just run it.

```sh
rstd run .api.rd

```

This is pretty much all you need if you want to be in the routine of running http requests manually. And because it is just a cli tool, you can pretty much use it combination with
any other cli tool, unix utility or otherwise.
