ALTER TABLE public.tasks
	ADD COLUMN rank text;

WITH ordered_tasks AS (
	SELECT
		id,
		row_number() OVER (
			PARTITION BY project_id, status
			ORDER BY created_at, id
		) AS position
	FROM public.tasks
)
UPDATE public.tasks AS t
SET rank = lpad(position::text, 8, '0')
FROM ordered_tasks ot
WHERE t.id = ot.id;

ALTER TABLE public.tasks
	ALTER COLUMN rank SET DEFAULT 'zzzzzzzz',
	ALTER COLUMN rank SET NOT NULL;

CREATE INDEX idx_tasks_project_status_rank
	ON public.tasks (project_id, status, rank);

