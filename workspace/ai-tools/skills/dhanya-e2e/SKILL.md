---
name: dhanya-e2e
description: How to write, run, debug and report end-to-end, accessibility and visual tests for the Dhanya rice ordering app using Playwright. Use whenever a Dhanya story needs a browser test, an E2E-J*, UI-A11Y-* or UI-VIS-* test ID is mentioned, a user journey between a shop and a mill must be checked, a Playwright test fails or flakes, or someone asks to test a screen, even if they don't say Playwright. Also use if someone asks for Selenium on this project.
---

# Dhanya browser testing

Read `sandbox/docs/plan/05-test-strategy.md` for the journeys, test IDs and permission matrix. This skill covers how to carry them out.

## Tool choice

Project tests use `@playwright/test` from `sandbox/`. It covers Chrome, Safari's engine, phone sizes, slow networks and several users at once, so Selenium isn't used here. If someone asks for Selenium, explain this and write the Playwright test.

The Playwright MCP connector is for looking around: trying a flow by hand, or seeing why a test fails. A pass in the connector proves nothing lasting, so finish by committing a real test.

## Layout

```text
tests/e2e/journeys/      one file per journey: j2-routine-order.spec.ts
tests/e2e/pages/         page objects: RatesPage, CartPage, MillInboxPage
tests/e2e/support/       fixtures: personas, clock, i18n, axe
tests/visual/            screenshot tests
tests/a11y/              axe tests across every screen
```

Put the test ID in the name so results trace back to the plan: `test('E2E-J2 routine order is auto-accepted', ...)`.

## Writing tests

**Find elements as a person would.** Use `getByRole`, `getByLabel` and `getByText`, and use `getByTestId` only where nothing else identifies the element, such as a total. CSS classes change whenever the design does.

**Take text from the language files, not from the test.** The same journey runs in English and Telugu:

```ts
await page.getByRole('button', { name: t('shop.cart.placeOrder') }).click();
```

**Use separate browser contexts for each person.** A shop and a mill are different logins, and many journeys need both at once:

```ts
test('E2E-J3 negotiation', async ({ shopPage, millPage }) => {
  // shopPage and millPage come from fixtures with their own sessions
});
```

**Create data through fixtures.** Each test makes its own mill, shop and products, because shared data makes tests depend on run order.

**Control time.** Never wait real hours for an offer to expire. Use the test clock header, which only works when `APP_ENV=test`.

**Wait for what the user would see.** Use `await expect(locator).toBeVisible()`. Don't use fixed sleeps like `waitForTimeout`, since they cause most flaky tests.

**Check exact money.** Compare against the worked examples in the test strategy (`₹27,342`), not "a total exists". Wrong money is the costliest bug here.

**Check what must stay hidden.** After a shop journey, confirm no book data appears on the page or in network responses (IT-BOOK-05). Check that shop logins can't open mill pages, and mill logins can't open shop pages.

## Screen sizes

| Project | Device | Use |
|---|---|---|
| `phone` | 360 x 740, touch, Chromium | Default for shop journeys |
| `phone-safari` | iPhone preset, WebKit | Full runs only |
| `desktop` | 1280 x 800, Chromium | Default for mill journeys |

## Slow networks and retries

E2E-J11 and J12 need network conditions. Use a CDP session on Chromium for throttling and `context.setOffline(true)` for offline. For double-tap tests, assert that exactly one order exists afterwards.

## Accessibility

Run axe on each screen in light and dark, and fail on serious or critical issues. Keyboard and focus tests go in `tests/a11y/`. Automated checks find only some problems, so UI-A11Y-05 stays a manual pass with TalkBack and VoiceOver.

## Visual tests

On Windows, fonts render differently from CI, so make baselines only through `npm run test:visual:update`, which uses the Playwright Linux container. Never update a baseline just to make a test pass. Look at the difference and say what changed and why.

## Running

```bash
npm run test:e2e:smoke                       # quick, used on every PR
npm run test:e2e -- --project=phone j2       # one journey
npm run test:e2e -- --ui                     # watch it run
npx playwright show-trace <trace.zip>        # replay a failure
```

Tests run against a production build with a throwaway database. Never point them at production.

## When a test fails

1. Read the trace and the error. Reproduce it once.
2. Decide which is wrong: the app, the test, or the environment. Compare with the plan, which defines correct behaviour.
3. If the app is wrong, fix the app, or report it if fixing isn't part of the task.
4. If it's flaky, find the cause. Retries are not a fix, and don't delete or skip the test to get a green run.

## Reporting

Report in plain language for a non-developer: which journeys passed, what failed as a person would see it, what you changed, and exact steps to see it yourself. Include the test IDs and the failing screenshot path.
