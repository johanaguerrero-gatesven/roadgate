UPDATE public.roadmap_capacity SET developers = 7 WHERE developers = 9;
DELETE FROM public.roadmap_capacity_history WHERE field = 'developers' AND old_value = '7' AND new_value = '9';