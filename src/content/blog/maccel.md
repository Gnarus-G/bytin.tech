---
title: "Making a linux kernel module"
description: "I successfully convinced myself that I need to make my own mouse acceleration driver for linux."
image: "/maccel_tui_thumbnail.png"
---

### Why?

I stopped using windows as my daily driver a couple years ago, in favor `linux`. There were two challenges with that.
The main one was that playing games on linux required a lot hoops to jump through. Thankfully not too long after my switch,
the `proton` project by valve started making it possible to play most of the games I'd play (on windows) on linux, easily.
Now the only game I still spin up my windows WM for is "Call of Duty: Cold War." I honestly almost never play COD anymore, so who cares
if it doesn't have linux support - it would be nice though.

The second challenge, related to gaming, was that [Raw Accel](https://github.com/a1xd/rawaccel/tree/master), a mouse pointer acceleration driver,
which I liked to use, only worked on Windows. I didn't know the first thing on how to get that software on linux. Now the reader might be thinking like I once did,

> Why would you want your mouse pointer to accelerate? Won't a real gamer completely disable pointer acceleration of any sort?

Well don't worry about it. Explaining the merits of this is out of the scope of this posting. I was convinced by a few youtube videos on the topic,
mainly this [video](https://www.youtube.com/watch?v=SBXv0xi-wyQ) by [pinguefy](https://www.youtube.com/@Pinguefy).

So, I tried to get the same kind of mouse acceleration that rawaccel did for me on linux. My progress on this, as best as I can recall, has been something
like:

- Google around and end up on the Arch linux guide for mouse acceleration, https://wiki.archlinux.org/title/Mouse_acceleration.
- Be super confused and intimidated by literally everything on that page, and the archlinux wiki in total.
- Feel shame and give up, "I don't really need mouse acceleration do I?"
- Months pass by.
- Nut up and try gain, landing this time on this github [leetmouse](https://github.com/Skyl3r/leetmouse) project: A linux driver like raw accel.
- Be once again confused and intimidated by idea of configuring a linux kernel module with `C` header file and compiling it only to find out
  that you don't have this installed or you have the wrong version of that installed, whatever this and that may be.
- Give up again, and let some time pass, forget how long.
- Try to use `hidapi` in rust to read mouse inputs and update the pointer position through the `X` server. Fail hilariously, laugh at the jankiness and give up.
- Try `leetmouse` earnestly, squirm around past the mistifying parts and get it working.
- Rejoice.
- Test, by feel, Raw accel on windows vs `leetmouse` and notice a difference.
- Try to figure out the difference between the parameters to try map one to the other.
- Lose interest for the umpteenth time. Obviously I'm doing other interesting things with my life during these periods. I hope.

This second challenge is the point of this posting. Essentially, I need this driver so I can have even more fun while playing Overwatch with my friends.
Yes, I use `archlinux` AND I have friends. I also figured if I can implement this kind of driver myself then
I would really understand how mouse acceleration works and how RawAccel takes
my little parameters like, ACCEL, OFFSET, OUTPUT_CAP and gives me the behavior that feels so good in my hand.
I also need to get over this irrational apprehension for writing `C` code.

### First Step

I start to read the book, [Linux Device Drivers](https://lwn.net/Kernel/LDD3/), aka LDD3, to understand how to start, in the hope
of maybe making a driver myself. I struggle with my ADHD through the book and reach the confidence to try it. I work my may up to step zero:
Coming up with a name; `maccel` <== 'Mouse ACCELeration'. Super creative :).

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
The cool thing with `insmod` is that it takes effect live in the kernel.

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

I read the whole chapter on [USB drivers](https://static.lwn.net/images/pdf/LDD3/ch13.pdf) from LDD3. I learned how to identify mice that our
driver can attach to. A simple example is running `lsusb`, look and see a mouse you recognize noting the vendor and device id.

```sh
...
Bus 005 Device 002: ID 1532:0078 Razer USA, Ltd Viper (wired)
...
```

We can then tell the kernel like we do in the C file above.

```c
static struct usb_device_id maccel_table[] = {{USB_DEVICE(0x1532, 0x0078)}, {}};
```

The whole process we want to implement is sending a request with USB Request Blocks (URB's) through the kernel to read from one of the many interfaces on a mouse.
It's basically a request and callback model, and each time the kernel calls us back we get
some data about what the user did with the mouse. It's the job of the driver to report that to the [input subsystem](https://www.kernel.org/doc/html/latest/driver-api/input.html).

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

I mentioned mice have many 'interfaces'. We only care about one, the one with the `MOUSE` protocol, coded with the number `02`. The easiest way to make sure the
driver attaches to any qualifying mouse is to use a macro provided in the linux kernel to represent that query.

```c
static struct usb_device_id maccel_table[] = {
    {USB_INTERFACE_INFO(USB_INTERFACE_CLASS_HID, USB_INTERFACE_SUBCLASS_BOOT,
                        USB_INTERFACE_PROTOCOL_MOUSE)},
    {} /* Terminating entry */
};
```

I learned these concepts and more over a couple of days. But, actually, one could just, and I mostly did, copy the hid driver implement [provided](https://github.com/torvalds/linux/blob/master/drivers/hid/usbhid/usbmouse.c)
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
V = sqrt(x^2 + y^2) / interval
```

The interval depends on your mouse polling rate, so if it's 1000Hz (the standard for gamers), the invertal is 1ms.
Now we use the variable to build the acceleration factor we apply to the `[x, y]` vector. I understand it, from the guide by RawAccel, to be:

```
(1 + a * V)
```

`a` is a parameter provided by the user, call it `Accel`.

So then the actual vector we report to the kernel is `[x_f, y_f]`:

```
[x_f, y_f] = [x, y] ⋅ (1 + a * V)
```

### Understanding linear acceleration

If you are like me, you need this other perspective to help you jive with this, so consider the following:

input vector `[x, y]`, interval `i`, input speed `v`, output velocity `f(v)` from RawAccel

```
v = sqrt(x^2 + y^2) / interval

f(v) = (1 + a * v) * v

```

So with the intuition that we want the system to think that `f(v)` is how fast we moved the mouse, and not `v` which how fast we actually moved it.
You might feel like multiplying `[x, y]` by `f(v)`, if you're as full of bad ideas as I am, but that's like trying to apply two different speeds to the same movement.
We want the vector that we would actually get if we really did move our mouse with that `f(v)` -
meaning we're in an event where this `f(v)` is the input speed for some input vector.

We need to normalize our `[x, y]` vector and apply that `f(v)` to that normal vector. In this way, we get `[x_f, y_f]`

```
[x_normal, y_normal] = [x, y] ⋅ (1 / v)

[x_f, y_f] = [x_normal, y_normal] ⋅ f(v)
```

I had a B- in linear algebra years ago, and forgot most of that B-, so now I'm more like a E+ in linear algebra. So Wikipedia is your friend. Wikipedia has been so
helpful to me recently that I threw them some change, if you know what I mean. I donated.

### Coding the function

Implementation would be pretty straight forward, but it's hard to use floating point numbers in the linux kernel. So I followed the lead of this leetmouse [fork](https://github.com/korsilyn/leetmouse)
and used the [fixedptc](https://sourceforge.net/p/fixedptc/code/ci/default/tree/) header only library. This library provides facilities for precise arithmetic operations on integers.

That context is required to understand why a very simple function might end up like the one below.

```c
static inline AccelResult f_accelerate(s8 x, s8 y, u32 polling_interval,
                                       fixedpt param_accel,
                                       fixedpt param_offset,
                                       fixedpt param_output_cap) {
  AccelResult result = {.x = 0, .y = 0};

  static fixedpt carry_x = FIXEDPT_ZERO;
  static fixedpt carry_y = FIXEDPT_ZERO;

  fixedpt dx = fixedpt_fromint(x);
  fixedpt dy = fixedpt_fromint(y);

  fixedpt distance =
      fixedpt_sqrt(fixedpt_add(fixedpt_mul(dx, dx), fixedpt_mul(dy, dy)));

  fixedpt speed_in = fixedpt_div(distance, fixedpt_fromint(polling_interval));

  fixedpt accel_factor = acceleration_factor(speed_in, param_accel,
                                             param_offset, param_output_cap);

  fixedpt dx_out = fixedpt_mul(dx, accel_factor);
  fixedpt dy_out = fixedpt_mul(dy, accel_factor);

  dx_out = fixedpt_add(dx_out, carry_x);
  dy_out = fixedpt_add(dy_out, carry_y);

  result.x = fixedpt_toint(dx_out);
  result.y = fixedpt_toint(dy_out);

  carry_x = fixedpt_sub(dx_out, fixedpt_fromint(result.x));
  carry_y = fixedpt_sub(dy_out, fixedpt_fromint(result.y));

  return result;
}

/**
 * Calculate the normalized factor by which to multiply the input vector
 * in order to get the desired output speed.
 *
 */
extern inline fixedpt acceleration_factor(fixedpt input_speed,
                                          fixedpt param_accel,
                                          fixedpt param_offset,
                                          fixedpt param_output_cap) {

  input_speed = fixedpt_sub(input_speed, param_offset);

  fixedpt accel_factor = FIXEDPT_ONE;

  if (input_speed > FIXEDPT_ZERO) {
    accel_factor =
        fixedpt_add(FIXEDPT_ONE, fixedpt_mul((param_accel), input_speed));

    if (param_output_cap != FIXEDPT_ZERO && accel_factor > param_output_cap) {
      accel_factor = param_output_cap;
    }
  }

  return accel_factor;
}

```

At this point I understand enough to be able to audit one of these leetmouse forks and know if I am getting RawAccel style linear acceleration or modify their code
to my liking, but that's too presumptuous. I've got an implementation here already, and can seamlessly proceed to port one more feature of RawAccel: the UI.

### Using multiple languages for the project

I don't know to make UI's in `C`. I know how to make cli's in `rust`, which I'm comfortable with. I'd never made a TUI at this point, and that should be easier than making a GUI. So time to learn
[ratatui](https://crates.io/crates/ratatui/), a rust crate for making Terminal UI's. Importantly, `C` can talk to `rust` through the System V ABI and
I can statically link my `C` code to my rust code when it's relevant.

`cargo` makes this easy with a `build.rs` file.

```rs
use std::{env, path::PathBuf};

fn main() {
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());

    cc::Build::new().file("src/libmaccel.c").compile("maccel");

    println!("cargo:rust-link-search=static={}", out.display());

    println!("cargo:rerun-if-changed=src/libmaccel.c");
    println!("cargo:rerun-if-changed=../driver/accel.h");
}
```

In `../driver/accel.h` we have this function we export with `extern`:

```c
/**
 * Calculate the normalized factor by which to multiply the input vector
 * in order to get the desired output speed.
 *
 */
extern inline fixedpt acceleration_factor(fixedpt input_speed,
                                          fixedpt param_accel,
                                          fixedpt param_offset,
                                          fixedpt param_output_cap) {
//...
}
```

And in rust we redeclare its prototype with the same 'symbol' for the identifier of the function - same function name - with syntax that rust understands
in an `extern` block with the `C` ABI selected mostly so that rust understands how the function parameters will be passed in.

```rs
extern "C" {
    fn acceleration_factor(
        speed_in: i32,
        param_accel: i32,
        param_offset: i32,
        param_output_cap: i32,
    ) -> i32;
}

/// Ratio of Output speed to Input speed
pub fn sensitivity(s_in: f32, params: Params) -> f64 {
    let s_in = fixedptc::fixedpt(s_in);
    let a_factor =
        unsafe { acceleration_factor(s_in.0, params.accel, params.offset, params.output_cap) };
    let a_factor: f32 = Fixedpt(a_factor).into();

    return a_factor as f64;
}
```

No we have this `sensitivity` function we use in rust to build a graph with the Chart widget from `ratatui`.

```rs
let data: Vec<_> = (0..100)
    .map(|x| x as f32)
    .map(|x| (x as f64, sensitivity(x, Params::new())))
    .collect();

let chart = Chart::new(vec![Dataset::default()
    .name(format!("f(x) = 1 + {}⋅x", Param::Accel.display_name()))
    .marker(symbols::Marker::Braille)
    .graph_type(GraphType::Line)
    .style(Style::default().green())
    .data(&data)])
.x_axis(x_axis)
.y_axis(y_axis);

frame.render_widget(
    chart.block(
        Block::default()
            .borders(Borders::NONE)
            .title("graph (Sensitivity = Speed_out / Speed_in)")
            .bold(),
    ),
    main_layout[1],
);
```

This ultimately gets us the graph we see in the TUI:
![image](/maccel_tui_thumbnail.png)

### Managing files in linux

One of the challenges of this project was figuring out how to use the linux file system to manage the user provided parameters. I wanted to make sure that the user doesn't need
to run the `maccel` cli with `sudo` to modify the kernel module's parameters, and to make sure that the values set by the user are remembered across reboots.

So we end up needing something like this make script.

```make
install: default
	@sudo cp -v $(DRIVERDIR)/*.ko $(MODULEDIR);
	@sudo chown -v root:root $(MODULEDIR)/*.ko;
	@sudo insmod $(MODULEDIR)/*.ko;
	sudo groupadd -f maccel;
	sudo depmod;
	sudo chown -v :maccel /sys/module/maccel/parameters/*;
	ls -l /sys/module/maccel/parameters/*
	@echo '[Recommended] Add yourself to the "maccel" group'
	@echo '[Recommended] usermod -aG maccel $$USER'
```

For ease of use, I provide [udev rules](https://wiki.archlinux.org/title/Udev)

```make
udev_install: build_cli
	sudo install -m 644 -v -D `pwd`/udev_rules/99-maccel.rules /usr/lib/udev/rules.d/99-maccel.rules
	sudo install -m 755 `pwd`/maccel-cli/target/release/maccel /usr/local/bin/maccel
	sudo install -m 755 -v -D `pwd`/udev_rules/maccel_bind /usr/lib/udev/maccel_bind
```

So that on reboot the `maccel_bin` shell script invoked by the udev rules binds all appropriate devices (mice)
and sets the last values the user set for the parameters.

```sh
maccel bind $1 &> /var/log/maccel-cli;

# For persisting parameters values across reboots
LIB_DIR=/var/lib/maccel
mkdir -p $LIB_DIR
chown -v :maccel $LIB_DIR
chmod -v g+w "$LIB_DIR"
ls $LIB_DIR/set_last_*_value.sh | xargs cat | sh &> /var/log/maccel-reset-scripts
```

### Conclusion

I genuinely expected to take a least a month of spending most nights on this, because I thought I
would need to know a lot more about all this than I do at this point to get something reliably working.
Apparently, the limiter wasn't my IQ, it was my resolve - Even though I thought it might take me months
to do anything useful, I did it anyway - a different attitude than I did last year, and thankfully
I found the energy for it.

You can find the project on github, https://github.com/Gnarus-G/maccel,
with install instructions.

I'd love some expert help in this endeavor, especially validating the math and precision of the algorithm as well as packaging for different distros.
I'm arguably the worst candidate for this kind of project; Terrible at math, Complete noob at developing for linux systems.
My only redeeming quality is that I have no life, and can afford to persevere through and land here. What fun though!
