 
# JLC's Midjourney Archiver

I Joakim L. Christiansen (hence JLC) made my own Midjourney archiver enabling me and anyone else who use it to create a local backup of their own Midjourney images (and to keep them in sync).

I created it since I experienced their online feature for batch downloading to be broken. And also because if you want to sync 1000's of images then it's a real hassle to do it manually anyway.

And it's very convenient to have your own local copy which you can browse through using whichever software you want. Instead of having to be stuck in the browser whenever you want to look through them.

I'm NOT in any way affiliated with the Midjourney company!

### Here is a screenshot of what it looks like:
![A screenshot of my archiver](imgs/scr6.png)

## Features

* No software to install (run it in any Chromium based browser).
* Remembers what it archived in its previous run; allowing you to sync only the latest changes and also to quickly resume if any errors caused it to stop (e.g. connection errors).
* The archive is fully portable, nothing is stored in the browser!
* Configure what to sync, e.g. skip low resolution grids and only keep the images that you upscaled or the high resolution v5+ grids.
* Get the high resolution v5+ grids without having to manually press a button on each one for a "virtual upscale job" (since they're already in a high resolution).
* Options to only sync the images you pressed like on or which you gave a certain rating.
* Will archive job details related to the archived images, e.g. the full command used.
* Allows downloaded images to be renamed or moved without causing any issues with the sync state (no re-downloads), since it keeps records on every image downloaded.

## How to use

[Visit this website and follow the instructions.](https://joakimch.github.io/jlc-midjourney-archiver/)

Basically it involves using a Chromium based browser (e.g. [Chrome](https://www.google.com/chrome/), Edge or Brave, NOT Safari or Firefox), pressing F12 to open up the DevTools, inserting a script into the console and pressing Enter to execute it.

It will then change their website (only in that tab) into my archiver. It has to be done this way or else their server will reject the HTTP requests coming from my archiver.

## Please sponsor this project

I am at the moment chronically sick, without a job, with tons of dept and two kids and a wife which I can't support economically. So please [sponsor my efforts](https://github.com/sponsors/JoakimCh) to develop a working solution like this, I would really appreciate it if you did! ❤️

## Why must it run in the browser? Time for a story...

Well, originally I had my archiver running in [Node.js](https://nodejs.org/) together with an SQLite database. But because Midjourney's API is protected by Cloudflare this suddenly stopped working. Basically it was detected that my API calls ran outside of a browser and this kind of usage suddenly became restricted.

Hence I had to mitigate their detection and the only way I could reliably do this was to actually run the archiver in the browser (pretending to be Midjourney website itself).

At fist I did this by using the Chrome DevTools Protocol to (locally) inject my own script into their website (which is impossible for them to reliably block). But since it also works to inject the script into their website via the DevTools Console (and this is the simpler way); this is what I have decided to do for now!

If they block it I'll find a way around their block. But I'm not trying to misuse their service or anything, all I want is just to enable a way for people to easily backup their own archives (which cost them money to create and which they legally own).

And to be fair, my archiver is configured to use multiple CDNs (content delivery networks) to spread out the server load. And if they want me to I'll lower the default concurrent downloads to a lower number than 10. But for now it seems to be a good choice. 🙂

## MIT License / Terms of Use

I made this and it's not "free for all" to create their own copies (or versions) of it and pretend to be the creators of it or monetize from it without giving me the credit that I deserve!

Hence here is a copy of the MIT license this project is licensed under:

Copyright (c) 2023 Joakim L. Christiansen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
