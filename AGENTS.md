<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Order totals, GST and packing are computed in the `place_order` database function; customers never write tables directly (prevents price tampering).
- Staff access: first signup becomes owner via auth trigger; managers are scoped per branch in `user_roles` and checked with `can_manage_branch`.
