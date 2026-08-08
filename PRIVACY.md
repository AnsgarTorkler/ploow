# Privacy Policy for Ploow

> **Template.** Complete every passage marked `[…]`. The text describes the
> software as it is actually built — if you later add features that reach the
> internet (telemetry, accounts, cloud backup, crash reporting), this policy has
> to grow with them. Not legal advice.
>
> This is the English counterpart of `DATENSCHUTZ.md`. Both describe the same
> processing under the GDPR.

**Controller within the meaning of the GDPR:**
[Full name or company], [Street and number], [Postcode, Town]
Email: [address@example.com], Phone: [number]
**Version of:** [Date]

## 1. In short

Ploow is a program that runs on your own device. Your texts, characters and
notes do not leave it. There is no account, no cloud, no tracking pixel and no
usage statistics.

One single exception: on startup, Ploow asks GitHub whether a newer version is
available. No content is transmitted. This check can be switched off in the
settings – after that, no network communication takes place at all. See
section 3 for details.

## 2. What is stored on your device

The Software stores the following data locally:

- **Project files** (`.story`) in the location you choose when saving. They
  contain your book data, characters, notes, images and attachments.
- **Backup copies** of the last twelve saved states, in a folder next to the
  project file.
- **Program settings and recently opened projects** in the application's user
  data folder.
- **An error log** (`protokoll.txt`) in the same folder. It contains timestamps
  and technical error messages, no content from your projects. You can view and
  delete it at any time via "About Ploow → Show log".

This data leaves your device only if you pass a file on yourself.

## 3. Updates

On startup, Ploow fetches a file from GitHub's servers in order to compare the
version number published there with its own. The address is

    https://github.com/AnsgarTorkler/ploow/releases/

**What is transmitted:** for technical reasons your IP address and the details
every HTTP request carries – program version, operating system and processor
architecture as part of the user agent. **What is not transmitted:** any content
from your projects, file names, file paths, or any identifier that would make
you or your device recognisable.

**Recipient:** GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA
94107, USA. The transfer to the USA relies on the EU-US Data Privacy Framework,
which GitHub has joined. GitHub's privacy statement is at
https://docs.github.com/site-policy/privacy-policies.

**Legal basis:** legitimate interest in the security and functioning of the
Software (Art. 6(1)(f) GDPR).

**Retention:** we store nothing ourselves – the request never reaches us, only
GitHub. How long GitHub keeps server logs is GitHub's decision.

**Objection:** the check can be switched off under *Settings → Updates*. After
that, Ploow establishes no network connection whatsoever. An available update is
never downloaded or installed on its own either – both happen only when you
click.

## 4. Purchase and support

When you buy through [payment provider / shop], the data you enter there is
processed; the privacy policy of [provider] applies in addition. If you send us
a support request, we process your email address and the content of your message
in order to answer it (Art. 6(1)(b) or (f) GDPR). We delete support messages
after [retention period].

## 5. Your rights

You have the right of access (Art. 15), rectification (Art. 16), erasure
(Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and
objection (Art. 21 GDPR). Please contact us at the address given above. You also
have the right to lodge a complaint with a supervisory authority, for example
[competent data protection authority].

Because we receive no personal data through your use of the Software, we can
neither provide information about your project content nor delete it — that data
resides solely with you.

## 6. Data security

The Software runs its user interface without system privileges, denies all
device permissions (camera, microphone, location, notifications) and prevents
content from being loaded from the network. Imported third-party files are
filtered before they are displayed.

You remain responsible for protecting the project files on your own device, for
example through disk encryption and regular backups.
