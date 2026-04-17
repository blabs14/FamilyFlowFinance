-- Remove tabelas e funções de um projeto externo (vídeo/IA) que foram
-- criadas neste schema por engano durante o desenvolvimento inicial.
-- Todas as tabelas tinham 0 rows. Verificado em 2026-04-17.

-- Funções alienígenas
DROP FUNCTION IF EXISTS public.update_ai_video_thumbnail_v9 CASCADE;
DROP FUNCTION IF EXISTS public.update_short_thumbnail_metadata CASCADE;
DROP FUNCTION IF EXISTS public.update_short_thumbnail_v2 CASCADE;

-- Tabelas filhas (dependem de outras tabelas alien)
DROP TABLE IF EXISTS public.ai_video_scenes CASCADE;
DROP TABLE IF EXISTS public.clips CASCADE;

-- Tabelas intermédias
DROP TABLE IF EXISTS public.ai_videos CASCADE;
DROP TABLE IF EXISTS public.clip_sources CASCADE;
DROP TABLE IF EXISTS public.research CASCADE;
DROP TABLE IF EXISTS public.shorts CASCADE;
DROP TABLE IF EXISTS public.trends CASCADE;
DROP TABLE IF EXISTS public.videos CASCADE;

-- Tabela raiz do cluster alien
DROP TABLE IF EXISTS public.projects CASCADE;

-- Tabelas de suporte do projeto externo
DROP TABLE IF EXISTS public.user_usage CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
