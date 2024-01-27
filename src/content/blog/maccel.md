---
title: "Making a linux kernel module"
description: "I successfully convinced myself that I need to make my own mouse acceleration driver for linux."
image: "/maccel_tui_thumbnail.png"
---

### Why?

I stopped using windows as my daily driver a couple years ago, in favor `linux`. There were two challenges with that.
The main one was that playing games on linux required a lot hoops to jump through. Thankfully not too long after my switch,
the `proton` project by valve started making it possible to to play most of the games I'd play (on windows) on linux, easily.
Now the only game I still spin up my windows WM for is "Call of Duty: Cold War." I honestly almost never play COD anymore, so who cares
if it doesn't have linux support - it would be nice though.

The second challenge, related to gaming, was that [Raw Accel](https://github.com/a1xd/rawaccel/tree/master), a mouse pointer acceleration driver
only worked on Windows. I didn't know the first thing for the get that software on linux. Now the reader might be thinking like I once did,

> Why would you want your mouse pointer to accelerate? Won't a real gamer completely disable acceleration of any sort.

Well don't worry about it. Explaining the merits of this is out of the scope of this posting. I was convinced by a few youtube videos on the topic,
mainly this [video](https://www.youtube.com/watch?v=SBXv0xi-wyQ) by [pinguefy](https://www.youtube.com/@Pinguefy).

So, I tried to get the same kind of mouse acceleration that rawaccel did for me on linux. The progress, as best as I can recall, has been something
like:

- Google around and end up on the Arch linux guide for mouse acceleration, https://wiki.archlinux.org/title/Mouse_acceleration.
- Be super confused and intimidated by literally everything on that page, and the archlinux wiki in total.
- Feel shame and give up, "I don't really need mouse acceleration do I?"
- Months pass by.
- Nut up an try gain, landing this time on this github [leetmouse](https://github.com/Skyl3r/leetmouse) project: A linux driver like raw accel.
- Be once agian confused and intimidated by idea of configuring a linux kernel module with `C` header file and compiling it only to find out
  that you this installed or you have the wrong version of that installed, whatever this and that may be.
- Give up again, and let some time passed, forget how long.
- Try to use `hidapi` in rust to read mouse inputs and update the pointer position through `X`. Fail hilariously, laugh at the jankiness and give up.
- Try `leetmouse` earnestly, squirm around past the mistifying parts and get working.
- Rejoice.
- Test, by feel, Raw accel on windows and `leetmouse` and notice a difference.
- Try to figure out the difference between the parameters to try map one to the other.
- Lose interest for the umpteenth time. Obviously I'm doing other interesting things with my life during these periods. I hope.

Essentially, I need this driver, so I can have even more fun while playing Overwatch with my friends. Yes, I use `archlinux` AND I have friends.
I also figured if I can implement this kind of driver myself then I would really understand how mouse acceleration works and how RawAccel takes
my little parameters like, ACCEL, OFFSET, OUTPUT_CAP and gives me the behavior that feels so good in my hand.
I also need to get over this irrational apprehension for writing `C` (them SEG fault though) code.

### First Step

I start to read the [Linux Device Driver](https://lwn.net/Kernel/LDD3/), aka LDD3, book to understand linux device drivers, in the hope
of maybe making one myself. I struggle with my ADHD through the book and reach the confidence to try it. I work my may up to step zero:
Comming up with a name; `maccel` <== 'Mouse ACCELeration'. Super creative :).

From the LDD3 book I learn how to register a usb kernel module.

`./maccel.c`

```c
#include "linux/init.h"
#include "linux/kern_levels.h"
#include "linux/mod_devicetable.h"
#include "linux/printk.h"
#include <linux/kernel.h>
#include <linux/module.h>
#include <linux/usb.h>

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Gnarus-G");
MODULE_DESCRIPTION("Mouse acceleration driver.");

static struct usb_device_id maccel_table[] = {{USB_DEVICE(0x1532, 0x0078)}, {}};

MODULE_DEVICE_TABLE(usb, maccel_table);

int probe(struct usb_interface *intf, const struct usb_device_id *id) {
  printk(KERN_INFO "plugged in (%04x:%04x)\n", id->idVendor, id->idProduct);
  return 0;
}

void disconnect(struct usb_interface *intf) {
  printk(KERN_INFO "maccel removed");
}

static struct usb_driver maccel_driver = {.name = "maccel",
                                          .id_table = maccel_table,
                                          .probe = probe,
                                          .disconnect = disconnect};

static int __init maccel_init(void) {
  int ret = -1;
  printk(KERN_INFO "registering driver");
  ret = usb_register(&maccel_driver);
  printk(KERN_INFO "registration complete");
  return ret;
}

static void __exit maccel_exit(void) {
  usb_deregister(&maccel_driver);
  printk(KERN_INFO "unregistration complete");
}

module_init(maccel_init);
module_exit(maccel_exit);
```

I learn how to build it with `make`, install it with `insmod` and remove it `rmmod`.
The cool thing with those `insmod` is that it adds the module so it takes effect live in the kernel.

`./Makefile`

```make
obj-m += maccel.o

CC=gcc
KDIR=/lib/modules/`uname -r`/build

default:
	$(MAKE) CC=$(CC) -C $(KDIR) M=$$PWD

install:
	sudo insmod maccel.ko

uninstall:
	sudo rmmod $(MOD_NAME)
```

### A working HID driver (without acceleration)

I read the whole chapter on [USB drivers](https://static.lwn.net/images/pdf/LDD3/ch13.pdf) from LDD3. I learned how to identify mice that kernel
attach to. A simple example is running `lsusb`, look and see a mouse you recognize, and noting the vendor and device id.

```sh
...
Bus 005 Device 002: ID 1532:0078 Razer USA, Ltd Viper (wired)
...
```

we can then tell the kernel like we do in the C file above.

```c
static struct usb_device_id maccel_table[] = {{USB_DEVICE(0x1532, 0x0078)}, {}};
```

The whole process we want to implement is sending a request with USB Request Blocks (URB's) through the kernel to read an IN interrupt
from one of the many interfaces on a mouse. It's basically a request and callback model, and each time the kernel calls us back we get
some data about what the user did with the mouse. It's the job of the driver to report that to the input subsystem.

```c
input_report_key(dev, BTN_LEFT, data[0] & 0x01);
input_report_key(dev, BTN_RIGHT, data[0] & 0x02);
input_report_key(dev, BTN_MIDDLE, data[0] & 0x04);
input_report_key(dev, BTN_SIDE, data[0] & 0x08);
input_report_key(dev, BTN_EXTRA, data[0] & 0x10);

input_report_rel(dev, REL_X, data[1]);
input_report_rel(dev, REL_Y, data[2]);
input_report_rel(dev, REL_WHEEL, data[3]);
```

Now I mentioned, mice have many 'interfaces'. We only care about one, the one with the `MOUSE` protocal, coded with the number `02`. The easiest to make sure the
driver attaches to any qualifying mouse is to use a macro provided in the linux kernel to represent that query.

```c
static struct usb_device_id maccel_table[] = {
    {USB_INTERFACE_INFO(USB_INTERFACE_CLASS_HID, USB_INTERFACE_SUBCLASS_BOOT,
                        USB_INTERFACE_PROTOCOL_MOUSE)},
    {} /* Terminating entry */
};
```

I learned these concepts and more over a couple of days. But, actually, I could just, and I mostly did, copy the [usbhid] hid driver implement [provided](https://github.com/torvalds/linux/blob/master/drivers/hid/usbhid/usbmouse.c)
by linux already. This is what `leetmouse` [originally](https://github.com/EricSchles/mousedriver) did.

### Understanding linear acceleration

The explanation from RawAccel themselves is veryful for this. They have a [guide](https://github.com/a1xd/rawaccel/blob/master/doc/Guide.md#measurements-from-input-speed).
It starts off great, but eventually threw me for a loop. But it's simpler if you, like me, only care about the linear acceleration behavior. So we can stop caring right before
they get into "anisotropic" settings, "Lp Norm" and "Lp Space." At least I hope we can, otherwise I'm fucked. After using my implementation of this behavior, it feels like I'm right.
Very rigorous, I know. Thank you.

Mouse inputs for how you moved your mouse come in as a vector for, we can say, how fast you moved horizontally and vertically. Call it an `[x, y]` vector.
`x` and `y` are both signed numbers.

We want to measure the speed in counts per milliseconds from that vector. `[x, y]` gives us the counts, and we can calculate the interval (ms) between reports of this count.
So the speed, call it `V` is:

```
V = sqrt(x^2 * y^2) / interval
```

The interval depends on your mouse polling rate, so if it's 1000Hz (the standard for gamers), the invertal is 1ms.
Now we use the variable to build the acceleration factor we apply to the `[x, y]` vector. I understand it, from the guide by RawAccel, to be:

```
(1 + a * V)
```

`a` is a parameter provided by the user, call it `Accel`.

So then actual vector we report to the kernel is:

```
[x_f, y_f] = [x, y] ⋅ (1 + a * V)
```

If you are like me, to help you jive with this, then consider the following:

input vector `[x, y]`, interval `i`, input speed `v`, output velocity `f(v)` from RawAccel

```
v = sqrt(x^2 * y^2) / interval

f(v) = (1 + a * v) * v

```

So with the intuition that we the system to think that `f(v)` is how fast we moved the mouse, and not `v` which how fast we actually moved it.
You might be tempted to just multiply `[x, y]` by `f(v)` but that's like trying to apply two different speeds to the same movement. We want to vector
that we would actually happen if we really did move our mouse with that `f(v)` - meaning we're considering a event where this `f(v)` is the input speed for some other vector.

We gotta normalize our `[x, y]` vector and apply that `f(v)` to that normal vector. In this way, we get `[x_f, y_f]`

```
[x_normal, y_normal] = [x, y] ⋅ (1 / v)

[x_f, y_f] = [x_normal, y_normal] ⋅ f(v)
```

### Coding the function

...

### Using multiple languages for the project

...

### Managing files in linux

...

### Conclusion

I'd love some expert help in this endeavor. I'm the worst candidate for this kind of project; Terrible at match, Complete noob at developing for linux
systems. My only redeeming quality is that I have no life, and can afford to persevere through and land here. What fun though!
