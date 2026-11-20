# Nami Reads

Short reads that appear in Nami under Insights and at the foot of related
screens. Each read is one file in `_reads/`. Merging a change to `main`
publishes it: GitHub Pages rebuilds the site, the read appears at
`https://meliodeveloper.github.io/nami-privacy/reads/<file name>/`, and the
app picks it up from `reads/index.json` the next time it checks (at most once
a day).

## Edit a read

1. Open the file in `_reads/` on GitHub and press the pencil.
2. Change the words under `sections`. Keep each `text:` indented as it is.
3. Update `checked:` to today's date.
4. Commit to a new branch and open a pull request. Merging it publishes.

## Add a read

Copy an existing file, give it a new file name (lower case, hyphens, this is
its id and must never change once published), and fill in every field.

| Field | What it does |
| --- | --- |
| `title`, `dek` | The headline and the one line under it. |
| `topic` | `pay_tax`, `spending`, `borrowing` or `saving`. |
| `minutes` | Reading time. About 70 words a minute on a phone. |
| `symbol` | The SF Symbol drawn beside it in the app. |
| `order` | Position in the list, lowest first. |
| `shows_when` | When the app offers it as "For you". Only the keys below work. Empty means it is never picked for you. |
| `foot_of` | Which screens show it as an About row. Keys below. |
| `your_numbers` | Which box of the reader's own figures the app draws. `none` for no box. |
| `ask` | The question Ask Nami opens with. |
| `checked`, `review_by` | When the facts were last checked, and when they must be checked again. |
| `sources` | Where the facts come from. Official sources first. |
| `min_app_version` | Optional. Hides the read from older app versions. |
| `draft: true` | Optional. Keeps it off the site and out of the app. |

`shows_when` keys: `payslip_tax_code_unusual`, `payslip_first_read`,
`payslip_student_loan`, `payslip_pension`, `budget_ahead_of_spread`,
`subscriptions_four_plus`, `fees_this_month`, `flex_account`,
`season_new_tax_year`.

`foot_of` keys: `payslip`, `budget`, `insights_fees`, `account_credit`,
`net_wealth`, `income`, `subscriptions`.

`your_numbers` keys: `tax_code`, `payslip_deductions`, `student_loan_payslip`,
`pension_payslip`, `budget_pace`, `subscriptions_month`, `fees_month`,
`flex_balance`, `none`.

## Art

Each read has a scene behind its title in the app and on its web page, and a
square thumbnail in lists: `reads/art/<id>.jpg` (1290 by 1000) and
`reads/art/<id>-thumb.jpg` (360 by 360). `reads/art/reads.jpg` is the general
Reads scene at the top of the list. A read can borrow another read's art with
`art: <other id>`.

The scenes are drawn, not photos: layered hills or peaks, a sky, a sun or
moon, in the read's topic colours (Pay & tax blues, Spending greens,
Borrowing ambers, Saving lilacs). `tools/read-art/` holds the drawing page and
each scene's settings in `scenes.json`. Add a scene there for a new read, and
run `node render.js ../../reads/art` from that folder to draw them all. If a
read has no art yet, the app draws its topic's colours instead.

## House rules

- Explain, never recommend a product or provider.
- No figures about the reader in the text. The app draws those itself.
- British English, plain words, about 250 words at most.
- Every figure in the text has a source and a `review_by` date. Tax figures
  are checked every April.
