-- Extensões e enums usados pelo restante do schema.

create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'moderator', 'owner', 'professional', 'user');
create type business_status as enum ('pending', 'active', 'suspended', 'rejected');
