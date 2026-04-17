-- 用户资料表
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null,
  avatar_colors text[] default array['#7C3AED', '#EC4899', '#F59E0B'],
  created_at timestamp with time zone default timezone('utc', now())
);

-- 动态表
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  tier text check (tier in ('starlight', 'glimmer')) not null default 'glimmer',
  keywords text[] default '{}',
  likes_count integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 点亮记录表
create table if not exists likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(post_id, user_id)
);

-- 评论表
create table if not exists comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  sincerity_score integer default 60,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 点赞数自增函数
create or replace function increment_likes(post_id uuid)
returns void as $$
  update posts set likes_count = likes_count + 1 where id = post_id;
$$ language sql;

-- RLS 策略
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

create policy "profiles: public read" on profiles for select using (true);
create policy "profiles: own write" on profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on profiles for update using (auth.uid() = id);

create policy "posts: public read" on posts for select using (true);
create policy "posts: auth insert" on posts for insert with check (auth.uid() = user_id);
create policy "posts: own delete" on posts for delete using (auth.uid() = user_id);

create policy "likes: public read" on likes for select using (true);
create policy "likes: auth insert" on likes for insert with check (auth.uid() = user_id);

create policy "comments: public read" on comments for select using (true);
create policy "comments: auth insert" on comments for insert with check (auth.uid() = user_id);
