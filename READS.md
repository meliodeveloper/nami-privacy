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

## House rules

- Explain, never recommend a product or provider.
- No figures about the reader in the text. The app draws those itself.
- British English, plain words, about 250 words at most.
- Every figure in the text has a source and a `review_by` date. Tax figures
  are checked every April.
