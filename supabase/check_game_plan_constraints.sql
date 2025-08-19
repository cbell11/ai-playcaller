-- Query to show all constraints on game_plan table
SELECT
    con.conname as constraint_name,
    con.contype as constraint_type,
    pg_get_constraintdef(con.oid) as constraint_definition,
    con.condeferrable as is_deferrable,
    con.condeferred as is_deferred
FROM
    pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
WHERE
    rel.relname = 'game_plan'; 