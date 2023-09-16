---
title: "Better than Postman, better than curl"
description: "Motivation for a DSL Rest Client to replace GUI ones."
---

### In the beginning, there was Postman

From the beginning of my career, I have been a fullstack web dev. I started with SpringBoot and then learned React quickly after.

If I wanted to test and api endpoint while developing it, I would just call it from the UI code and look that network tab - or `console.log` -
to debug, because of course the UI code and the backend code is all part of one usecase/feature.

But sometimes, I would develop the API in isolation and so I would use postman. Mind you,
I was never a power user of postman, never paid, never did load testing or anything like that. I only went as
far as using environment variables, and graphql.

### And then there was Vim

At some point, I skilled up and started using Vim motions - shout out [Ben Awad](https://www.youtube.com/@bawad)
for the [video](https://www.youtube.com/watch?v=4WTV6ZCY4qo) that convinced me to do so.
Later, I started using neovim - I use neovim, btw - after watching the [ThePrimeagen](https://www.youtube.com/@ThePrimeagen) show off a bunch.

No really, I had to get off of vscode. This is a tangent, but... I only had 16GB of memory. Between vscode, teams, chrome, and the bloated memory guzzling
create-react-app I was getting paid to suffer at the time; something had to give. I often ran out memory, I felt input lag from vscode, the LSP started ignoring me.
vscode had to give. I'll stop venting here.

After picking up neovim, for about the next year, I only did UI dev. I got used to most of my work getting done in the terminal. I became more familiar with unix utils.
Inevitably, I gradually developed a small disdain for GUIs, especially when the problem they solved could be solved more effectively in the terminal with a cli tool. This
was a mostly unconscious disdain for a while.

### Postman the sequel

I returned to fullstack, and started using Postman again. Soon I became very conscious of always having to leave my terminal, move my mouse,
and do a few clicks just to basically

```sh
curl https://jsonplaceholder.typicode.com/todos/1
```

Let us face it, I, you too maybe, get paid to edit text all day. Naturally, I am always on the lookout for how to do that as efficiently as possible,
hence me learning vim and linux. Most GUIs are not inline with that aim. Of course Postman has a lot of features `curl` does not, most of witch I do not care about.
All I need is curl is the simplest case. In the case that Postman is more useful to me, it's becuase of environment variables and the ability to interpolate those variables
into your request - like having a base url, or a common bearer token.

### They so often wondered if they should, that they never pondered if they could.

The problem is simple. I want to open a file define an http request and then run it. Already I thought to do what I have seen a coworker do: write curl commands
is a shell script. I don't like that as much because reusing values, and defining json in the curl command won't be as simple and fun. And so...

Would not a custom DSL for defining REST requests be awesome for this, along with a cli and runtime that manage those reusable values as environment variables?
Yes, it would. Nevermind I was already learning about parsers and interpreters from [thorstenball](https://mrnugget.gumroad.com/)'s book, and this seemed like a
good excuse to put those lessons to use.

Nevermind Postman, I will just edit a text file; Thanks.
Nevermind curl, I do not like the interface.

I would much rather, just open a file and write

```rd
set BASE_URL env("devOrigin")

@log // for printing the response body to stdout
get /users {
  header "Authorization" env("token")
}

//... any other requests can be added to the same file
```

Say the file is `./api.rd`, you can just run it.

```sh
rstd run ./api.rd

```

This is pretty much all you need if you want to be in the routine of running http requests manually. And because it is just a cli tool, you can pretty much use it combination with
any other cli tool, unix utility or otherwise.

### They could.

I am running the experiment. So far I've implemented what you see above and more.

```
Language/Interpreter for easily defining and running requests to an http server.

Usage: rstd [OPTIONS] <COMMAND>

Commands:
  run         Run a script written in the language
  scratch     Open your default editor to start editing a temporary file
  env         Operate on the environment variables available in the runtime
  completion  Generate a completions file for a specified shell
  lsp         Start the rested language server
  config      Configure, or view current configurations
  help        Print this message or the help of the given subcommand(s)

Options:
  -l, --level <LEVEL>  Set log level [default: info]
  -h, --help           Print help
  -V, --version        Print version
```

I am calling the project `rested` and it's al ready a better experience than Postman.
So I win. If you're so inclined, try it, open issues, and maybe make feature request: [https://github.com/Gnarus-G/rested](https://github.com/Gnarus-G/rested)

```sh
cargo install rested
```

### Conclusion

In the simple case curl is still best, becuase it requires the least ceremony before you fire the request. I think this has the potential to reduce a lost of wasted time.
Especially thanks to the lsp intergration, and the scratch interface which eliminates the friction of choosing where to save files that hold your one-off requests.
Again this is all still experimental, but I'm interested to see if this idea has enough merit to appeal
to anyone other than me.
