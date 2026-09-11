alter table public.bought_drops
  add column capture_mode text not null default 'screen'
  check (capture_mode in ('camera', 'screen'));

update public.bought_drops
set capture_mode = 'camera'
where category in (
  'BEEF',
  'CHAOS',
  'UNPOPULAR OPINION',
  'I WAS WRONG',
  'THE RANT',
  'CONFESSIONS'
);

alter table public.bought_drops
  add constraint bought_drops_capture_matches_category check (
    (
      category in (
        'BEEF',
        'CHAOS',
        'UNPOPULAR OPINION',
        'I WAS WRONG',
        'THE RANT',
        'CONFESSIONS'
      )
      and capture_mode = 'camera'
    )
    or
    (
      category not in (
        'BEEF',
        'CHAOS',
        'UNPOPULAR OPINION',
        'I WAS WRONG',
        'THE RANT',
        'CONFESSIONS'
      )
      and capture_mode = 'screen'
    )
  );
