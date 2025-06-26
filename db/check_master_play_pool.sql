-- Check if table exists and get its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_name = 'master_play_pool'
ORDER BY 
    ordinal_position;

-- Get count of records
SELECT COUNT(*) FROM master_play_pool;

-- Sample a few records to see the data
SELECT * FROM master_play_pool LIMIT 5; 