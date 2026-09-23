-- Item IDs only need to be unique inside one roadmap, not across all of a user's roadmaps.
-- Rollback: alter table public.roadmap_items drop constraint roadmap_items_roadmap_id_item_uid_key; add constraint roadmap_items_user_id_item_uid_key unique (user_id, item_uid);
alter table public.roadmap_items drop constraint if exists roadmap_items_user_id_item_uid_key;
alter table public.roadmap_items add constraint roadmap_items_roadmap_id_item_uid_key unique (roadmap_id, item_uid);