# Gym signup links

Each link pre-selects that gym on `/signup` (still editable if someone
follows the wrong one). Use these anywhere a gym-specific signup link is
needed — a waitlist confirmation email, an ad campaign's landing page, a
newsletter, printed signage, wherever.

| Gym | Link |
|---|---|
| Aylesbury Berryfields | https://podhq-client.vercel.app/signup?gym=Aylesbury%20Berryfields |
| Basingstoke | https://podhq-client.vercel.app/signup?gym=Basingstoke |
| Berkhamsted | https://podhq-client.vercel.app/signup?gym=Berkhamsted |
| Crewe | https://podhq-client.vercel.app/signup?gym=Crewe |
| Fairford Leys | https://podhq-client.vercel.app/signup?gym=Fairford%20Leys |
| Hackney | https://podhq-client.vercel.app/signup?gym=Hackney |
| Hove (Brighton) | https://podhq-client.vercel.app/signup?gym=Hove |
| Kingston upon Thames | https://podhq-client.vercel.app/signup?gym=Kingston%20upon%20Thames |
| Milton Keynes | https://podhq-client.vercel.app/signup?gym=Milton%20Keynes |
| Oxford East | https://podhq-client.vercel.app/signup?gym=Oxford%20East |

Built 2026-08-18 (see `ROADMAP.md`, "Signup gym pre-fill via `?gym=`
link"). The gym names must match `GYM_NAMES` in `src/lib/gym.ts` exactly
— if a gym is ever renamed there, update its link here too.
