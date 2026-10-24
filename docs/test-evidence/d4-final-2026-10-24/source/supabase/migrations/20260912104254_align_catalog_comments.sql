comment on table public.products is
  'Sellable fashion catalogue items. Public API access is limited to is_available rows.';

comment on column public.cross_sell_rules.priority is
  'Higher values are selected first by the flattened catalogue view.';
