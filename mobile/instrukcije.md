SIM TRACKER — MASTER UI/UX DESIGN DIRECTION

You are redesigning and evolving the UI/UX of an existing production-oriented mobile application called SIM Tracker.

This is NOT a generic SaaS application.

This is an operational field application used for managing SIM cards, meter installations, removals, inventory, scanning, installation records and synchronization between mobile devices and a backend system.

The repository already contains the implementation.

Before changing anything, inspect the existing application thoroughly.

1. FIRST: UNDERSTAND THE PRODUCT

Do not start by changing colors, cards or spacing.

First understand the actual product and its workflows.

The mobile application currently contains concepts including:

authentication
dashboard/home
SIM inventory
SIM card ICCID scanning
barcode scanning using the device camera
manual ICCID entry
installation workflows
demount/removal workflows
installation records
record details
scan results
offline inventory
offline outbox
synchronization
notifications
user profile
connectivity/offline states
meter types
installation tasks
replacement workflows

The application is designed for users who may be operating in the field rather than sitting at a desk.

This means usability under real-world conditions is more important than decorative design.

The interface must work extremely well when:

the user is standing
the user is moving
lighting conditions are poor
the user is wearing gloves
the user has limited attention
the device has poor connectivity
the user needs to perform repetitive operations quickly
the user needs to scan many SIM cards consecutively

The product should therefore feel like professional field equipment software, not like a generic mobile CRUD application.

2. CORE DESIGN GOAL

The target aesthetic is:

Premium + clean + modern + operational + technical + trustworthy

The desired emotional response is:

"This is a serious professional tool that was carefully designed."

Not:

"This is a beautiful template."

The UI should feel expensive because of its:

precision
typography
spacing
hierarchy
interaction quality
consistency
responsiveness
information architecture

Not because of excessive decoration.

3. DESIGN BENCHMARKS

Use the following products as QUALITY references:

Linear

Learn from:

hierarchy
typography
spacing
restrained visual language
excellent states
subtle interaction
premium feeling
information density

Do NOT copy Linear's visual identity.

Vercel

Learn from:

simplicity
visual restraint
monochrome foundations
typography
sharp hierarchy
extremely intentional use of accent colors

Do NOT make the application look like Vercel.

Stripe

Learn from:

data presentation
status communication
forms
structured information
professional financial/operational UI
confidence and trust
Raycast

Learn from:

command-oriented interaction
keyboard/action mentality
speed
compact controls
power-user workflows
Apple

Learn from:

clarity
touch interaction
hierarchy
native-feeling motion
progressive disclosure
4. DOMAIN-SPECIFIC DESIGN LANGUAGE

SIM Tracker belongs to the intersection of:

Telecommunications + utilities + field operations + inventory management + IoT

The visual language should therefore communicate:

connectivity
infrastructure
precision
field operations
technology
reliability
traceability

Possible visual metaphors:

signal
connectivity
network
SIM/eSIM
device
meter
installation
scanning
synchronization
operational status

These metaphors should be subtle.

Do NOT turn the interface into a collection of telecom illustrations.

5. BRAND CHARACTER

The application should feel:

precise
intelligent
reliable
technical
calm
fast
modern
professional
operational

Avoid making it:

playful
childish
overly corporate
futuristic for the sake of being futuristic
visually noisy
overly colorful
overly rounded
overly glassy
6. COLOR STRATEGY

The existing brand uses a strong blue primary color.

Preserve the conceptual identity of blue, but refine the visual system if necessary.

The primary color should communicate:

connectivity
trust
technology
action

Use the primary color selectively.

Do NOT make every element blue.

Recommended conceptual structure:

Primary:

brand/action blue

Neutral:

near-white
soft gray
slate
dark graphite

Semantic:

success = green
warning = amber
danger = red
offline = neutral/amber depending on context
synchronization = blue
pending = amber/neutral

The UI should be approximately:

80–90% neutral surfaces/text
10–20% semantic/brand color

Color must communicate meaning.

7. IMPORTANT: DO NOT OVERUSE CARDS

Avoid "card soup".

Do not place every piece of information inside a rounded white rectangle.

Instead use:

sections
dividers
typography
grouped content
subtle surface elevation
inline status indicators
list rows
structured information blocks

Cards should represent meaningful conceptual groups.

A card should answer:

"Why does this content belong together?"

If there is no good answer, don't use a card.

8. BORDER RADIUS

Avoid excessive pill-shaped UI.

Do not make everything:

pill
bubble
rounded rectangle

Use a restrained radius system.

Suggested conceptual hierarchy:

Small controls:
8px

Inputs:
10–12px

Important surfaces:
12–16px

Large feature surfaces:
16–20px

Full pills:
ONLY for semantic statuses, filters or compact tags.

9. TYPOGRAPHY

Typography should feel modern and technical.

Prioritize:

strong hierarchy
excellent readability
compact metadata
clear numerical presentation

Use different typographic roles for:

Page titles

Strong, confident, relatively large.

Section titles

Smaller and more restrained.

Data

High readability.

Numbers such as:

ICCID
SIM identifiers
meter identifiers
quantities
timestamps

must be especially legible.

Identifiers may use slightly increased letter spacing or a suitable technical/monospaced treatment where appropriate.

Do not use monospace everywhere.

10. HOME / DASHBOARD

The home screen should NOT simply be a collection of statistic cards.

Its primary purpose is:

Tell the operator what matters right now.

The dashboard should prioritize:

operational state
important pending work
inventory status
synchronization/connectivity
recent activity
secondary statistics

The interface should answer within seconds:

Am I online?
Is my data synchronized?
Do I have pending work?
How much inventory do I have?
Is anything wrong?
What should I do next?

Do not overwhelm the operator with analytics.

This is an operational dashboard, not a BI dashboard.

11. SCANNING IS A PRIMARY EXPERIENCE

The scanning screen is one of the most important screens in the application.

Treat it as a first-class workflow.

The user should immediately understand:

"Point camera → scan → continue."

The scanner should visually dominate the screen.

Avoid unnecessary UI around the camera.

Use:

clear scanning frame
strong but restrained guidance
obvious scanning state
successful scan feedback
error feedback
scan-again action

Scanning feedback should be immediate.

Use:

subtle visual confirmation
vibration
audio when appropriate

Do not create excessive animation.

12. SCAN RESULT

After scanning an ICCID, the user should immediately understand:

What was scanned?

ICCID

What does it correspond to?

SIM / inventory information

What can I do next?

Relevant actions.

Avoid forcing the user to read a large amount of information before continuing.

Primary action should be visually dominant.

Secondary information should be progressively disclosed.

13. INSTALLATION WORKFLOW

Installation is an operational workflow.

Design it like a guided procedure.

The user should always know:

where they are
what has been completed
what remains
what data is required
whether the current step is valid

Use a clear visual progression.

Example conceptual structure:

INSTALLATION

Step 2 of 4

SIM CARD
✓ ICCID scanned

METER
✓ Selected

LOCATION
○ Waiting

CONFIRMATION
○ Pending

Do not turn this into an oversized wizard with unnecessary decoration.

The progress indicator should be compact and informative.

14. DEMOUNT / REMOVAL

Demount workflows should visually distinguish themselves from installation.

The UI must clearly communicate:

This operation removes something from service.

Use strong semantic confirmation.

Before destructive actions, clearly show:

what will be removed
which SIM
which meter/device
relevant identifiers
consequences

The final destructive action must be explicit.

Never hide destructive actions behind ambiguous labels.

15. INVENTORY

Inventory is a high-information workflow.

Prioritize:

search
filtering
availability
status
ICCID
SIM state
relevant metadata

The UI should support rapid scanning of many records.

Do not make every inventory item look like a large product card.

Prefer compact, structured list rows.

Example conceptual pattern:

SIM-001
894450xxxxxxxxxxx

AVAILABLE
Telekom
Updated 2 min ago

The user should be able to scan the list visually very quickly.

16. RECORDS

Records should feel like a professional operational log.

Prioritize:

status
date/time
SIM
meter
operation type
operator
synchronization state

Use strong status indicators.

Statuses should be instantly recognizable without requiring the user to open the record.

17. OFFLINE-FIRST UX

Offline support is NOT an implementation detail.

It is part of the product experience.

The user must always understand:

whether they are online
whether data is fresh
whether actions are queued
whether synchronization is happening
whether synchronization failed
whether local data differs from server data

However:

DO NOT constantly show giant "YOU ARE OFFLINE" banners.

Use calm persistent indicators.

Example:

● Offline
Last synced 14:32

or:

3 actions waiting to sync

The UI should communicate offline state without creating panic.

18. SYNCHRONIZATION

Synchronization should feel reliable and transparent.

Use states:

synced
syncing
queued
failed
stale

Each state should have:

visual indicator
understandable label
appropriate action

Avoid technical terminology such as:

HTTP error
mutation queue
cache invalidation

The operator does not need implementation details.

19. NOTIFICATIONS

Notifications should prioritize operational importance.

Use hierarchy:

Critical

Requires immediate attention.

Important

Requires action soon.

Informational

Useful but not urgent.

Do not make all notifications visually identical.

20. PROFILE

Profile should be intentionally simple.

It is not a major workflow.

Use:

identity
role
account information
application settings if necessary
logout

Avoid decorative profile dashboards.

21. NAVIGATION

The bottom tab navigation should represent the most important operator workflows.

Navigation should feel:

stable
predictable
fast
easy to reach with one hand

The primary operational action — scanning — should have strong visual prominence if that matches the existing product architecture.

Do not introduce navigation complexity merely for visual novelty.

22. EMPTY STATES

Never show:

"No data."

alone.

Explain:

what is empty
why it may be empty
what the user can do

Example:

No SIM cards available

Your offline inventory is currently empty.

Sync inventory
23. LOADING STATES

Avoid generic centered spinners wherever possible.

Prefer:

skeletons
contextual loading indicators
inline progress
button loading states

The UI should preserve layout during loading.

Avoid layout jumps.

24. ERROR STATES

Errors must be:

understandable
actionable
calm

Never expose backend implementation details.

Bad:

AxiosError 500

Good:

Synchronization failed.
Your changes are محفوظane locally and will be retried.

Use appropriate actions:

Retry
Sync again
Continue offline
25. MICRO-INTERACTIONS

Use motion to communicate state, not decoration.

Good examples:

scan success
button press
list insertion
synchronization progress
status change
modal transition
navigation transition

Avoid:

excessive bouncing
parallax
continuous floating animation
gratuitous gradients
decorative motion

Motion should generally feel:

fast + subtle + physical

26. TOUCH TARGETS

This is a field application.

Controls must be comfortably tappable.

Never optimize for visual compactness at the expense of touch accuracy.

Primary actions should be easy to hit with one thumb.

Important destructive actions should NOT accidentally sit directly next to common actions.

27. ONE-HANDED OPERATION

Assume many interactions happen with one hand.

Important controls should generally be:

reachable
obvious
large enough
positioned predictably

Do not force the operator to perform unnecessary navigation.

28. INFORMATION DENSITY

The application needs higher information density than a consumer app.

But density must be achieved through:

typography
spacing
alignment
hierarchy

NOT by:

tiny fonts
cramped controls
excessive borders

Target:

dense but breathable

29. ICONOGRAPHY

Use a consistent icon family.

Icons should communicate functionality.

Do not use icons merely as decoration.

Avoid mixing:

filled icons
outlined icons
random emoji
unrelated icon styles

unless there is a clear semantic reason.

30. AI-GENERATED UI ANTI-PATTERNS

NEVER automatically introduce:

excessive glassmorphism
giant gradients
glowing borders
neon colors
excessive shadows
excessive rounded corners
excessive pills
floating blobs
decorative 3D objects
fake AI visual effects
unnecessary illustrations
huge hero sections inside the application
"AI-looking" purple gradients
card grids for everything
dashboard KPI overload
unnecessary charts
oversized empty space
tiny unreadable text

The application must NEVER look like an AI-generated template.

31. DO NOT DESTROY EXISTING FUNCTIONALITY

This is an existing application.

Before modifying UI:

inspect the existing component architecture
inspect navigation
inspect state management
inspect API usage
inspect offline architecture
inspect query/cache behavior
inspect camera/scanning implementation
inspect theme
inspect reusable components
understand all current workflows

Do not rewrite working business logic merely to change appearance.

Separate:

presentation changes

from:

behavior changes

Whenever possible.

32. EXISTING DESIGN SYSTEM

The repository already contains a theme system and reusable components.

Extend and improve the existing design system instead of creating unrelated one-off styling.

Prefer:

theme
↓
design tokens
↓
shared components
↓
screens

Not:

screen A → random styles

screen B → different styles

screen C → another style

All screens must feel like the same product.

33. DESIGN TOKENS

Create/refine tokens for:

colors
spacing
typography
radii
borders
shadows/elevation
icon sizes
control heights
animation durations

Avoid magic numbers scattered throughout screens.

34. DARK MODE

If implementing dark mode, do NOT simply invert colors.

Dark mode should have its own hierarchy.

Prioritize:

OLED-friendly dark surfaces where appropriate
readable secondary text
restrained borders
preserved semantic colors
comfortable contrast

The blue brand color should remain recognizable without becoming excessively bright.

35. RESPONSIVE BEHAVIOR

The application must work across different mobile screen sizes.

Do not assume a single device size.

Test:

small Android phone
normal Android phone
large Android phone
devices with different aspect ratios
devices with display cutouts

Respect safe areas.

Keyboard interaction must not break forms.

36. ACCESSIBILITY

Maintain:

readable contrast
adequate touch targets
visible focus where applicable
understandable labels
semantic states
accessible feedback

Do not rely solely on color to communicate status.

For example:

✓ Synced
⚠ Pending
× Failed

can combine icon + text + color.

37. DESIGN DECISION PROCESS

Before implementing a screen, ask:

What is the user's primary task?
What information is most important?
What action is most important?
What can be hidden until needed?
What state can the user be in?
Does connectivity affect this screen?
Is this a repetitive workflow?
Can the user complete this with one hand?
Does the visual design communicate the domain?
Is this actually better than the existing implementation?

If the answer to #10 is no, do not change it.

38. PRIORITY ORDER

When making design decisions, prioritize:

Correctness
Usability
Operational speed
Information hierarchy
Accessibility
Consistency
Visual polish
Trendiness

Never reverse this order.

39. THE FINAL VISUAL TARGET

The final product should feel like:

A premium professional field-operations platform for telecommunications and utility infrastructure.

Imagine:

Linear's design discipline




Stripe's data clarity




Apple's touch interaction




Raycast's operational speed




telecommunications / utility infrastructure visual language




offline-first field workflow

The result should be unmistakably SIM Tracker.

It should NOT look like a clone of any of the reference products.

40. IMPLEMENTATION RULE

Do not redesign the entire application blindly.

Work iteratively.

For each screen:

inspect the current implementation
identify UX problems
define the desired hierarchy
improve the shared design system where necessary
implement the screen
preserve all existing functionality
check loading states
check error states
check offline states
check empty states
check interaction states
check small-screen layout
run TypeScript/typecheck
verify that navigation and business logic remain intact
41. MOST IMPORTANT PRINCIPLE

Do not optimize the application for screenshots.

Optimize it for the operator who will use it hundreds of times.

A screen that looks spectacular but makes scanning, installation, demounting or inventory management slower is a failed design.

The goal is:

"It looks premium."

AND:

"It is faster and easier to use."

Both must be true.
