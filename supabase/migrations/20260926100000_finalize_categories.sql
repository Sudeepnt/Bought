insert into public.bought_categories (name)
values ('PRODUCT LAUNCH')
on conflict (name) do nothing;
