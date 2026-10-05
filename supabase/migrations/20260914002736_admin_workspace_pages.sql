create or replace function public.db_admin_workspace(p_section text, p_options jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  o jsonb := p_options;
  source_sql text;
  result jsonb;
  page_sql text;
  series jsonb;
  context jsonb;
  order_dir text := case when o->>'direction' = 'asc' then 'asc' else 'desc' end;
  page_limit integer := least(20,greatest(1,coalesce((o->>'limit')::integer,20)));
  page_number integer := least(10000,greatest(1,coalesce((o->>'page')::integer,1)));
  page_offset integer := (least(10000,greatest(1,coalesce((o->>'page')::integer,1))) - 1) * least(20,greatest(1,coalesce((o->>'limit')::integer,20)));
  snapshot timestamptz := coalesce((o->>'asOf')::timestamptz,statement_timestamp());
begin
  o := o || jsonb_build_object('asOf',snapshot,'query',coalesce(o->>'query',''),'timeZone',coalesce(o->>'timeZone','UTC'),'id',coalesce(o->>'id',''),'type',coalesce(o->>'type','all'),'read',coalesce(o->>'read','all'),'sort',coalesce(o->>'sort','date'),'vote',coalesce(o->>'vote','all'),'reason',coalesce(o->>'reason',''));
  if p_section = 'summary' then
    select jsonb_build_object('unreadCount', count(*) filter(where read_at is null), 'total',count(*),
      'revision', concat(count(*),':',count(*) filter(where read_at is null),':',max(created_at),':',max(read_at))) into result
    from public.db_admin_notifications where dismissed_at is null;
    return result;
  end if;
  if p_section = 'overview' then
    series := public.db_admin_analytics((o->>'from')::timestamptz,(o->>'to')::timestamptz,o->>'timeZone');
    return jsonb_build_object('openReports',(select count(*) from public.db_comment_reports),'reportedComments',(select count(distinct comment_id) from public.db_comment_reports),'published',(select count(*) from public.db_posts where published),'posts',(select count(*) from public.db_posts),'series',series,'reads',(select coalesce(sum((x->>'views')::bigint),0) from jsonb_array_elements(series) x),
      'helpful',(select coalesce(sum((x->>'helpful')::bigint),0) from jsonb_array_elements(series) x),
      'unhelpful',(select coalesce(sum((x->>'unhelpful')::bigint),0) from jsonb_array_elements(series) x),
      'reports',public.db_admin_workspace('reports',o || jsonb_build_object('limit',5,'page',1,'from',null,'meta',false))->'items',
      'feedback',public.db_admin_workspace('feedback',o || jsonb_build_object('limit',5,'page',1,'meta',false))->'items',
      'from',o->>'from','to',o->>'to','timeZone',o->>'timeZone','updatedAt',snapshot);
  end if;
  if p_section='feedback_events' then
    select jsonb_build_object('title',coalesce(p.title,l.title,f.page_title),'id',o->>'id') into context from public.db_feedback_events f
    left join public.db_posts p on f.target_type='article' and p.id::text=f.target_id
    left join public.db_legals l on f.target_type='legal' and l.slug=f.target_id
    where f.target_type || ':' || f.target_id=o->>'id' order by f.created_at desc,f.id desc limit 1;
  end if;
  if p_section='feedback_events' and o->>'events'='false' then
    series := public.db_admin_analytics((o->>'from')::timestamptz,(o->>'to')::timestamptz,o->>'timeZone',o->>'id');
    return jsonb_build_object('items','[]'::jsonb,'asOf',snapshot,'page',1,'context',context,'series',series,'total',(select coalesce(sum((x->>'helpful')::bigint+(x->>'unhelpful')::bigint),0) from jsonb_array_elements(series) x));
  end if;
  if p_section = 'reports' then
    source_sql := $q$
      select c.id::text as id, jsonb_build_object('id',c.id,'title',p.title,'postId',c.post_id,'author',case when c.is_anonymous then 'Anonymous' else coalesce(c.author_name,'Anonymous') end,'content',c.content,'total',g.total,'latest',g.latest,'reason',g.reason) as payload,
        case when $1->>'sort'='total' then g.total else 0 end::numeric as n,
        case when $1->>'sort'='page' then lower(p.title) else g.latest::text end as t
      from (select comment_id,count(*) as total,max(created_at) as latest,mode() within group(order by reason) as reason from public.db_comment_reports
        where created_at <= ($1->>'asOf')::timestamptz and ($1->>'from' is null or created_at >= ($1->>'from')::timestamptz) and created_at < ($1->>'to')::timestamptz
        and ($1->>'reason'='' or reason=$1->>'reason') group by comment_id) g
      join public.db_comments c on c.id=g.comment_id join public.db_posts p on p.id=c.post_id
      where (coalesce($1->>'postId','')='' or c.post_id::text=$1->>'postId') and ($1->>'query'='' or to_tsvector('simple',coalesce(c.content,'') || ' ' || coalesce(c.author_name,'') || ' ' || p.title) @@ websearch_to_tsquery('simple',$1->>'query'))
    $q$;
  elsif p_section = 'feedback' then
    source_sql := $q$
      select g.target_type || ':' || g.target_id as id,
        jsonb_build_object('id',g.target_type || ':' || g.target_id,'title',coalesce(p.title,l.title,g.title),'targetType',g.target_type,'targetId',g.target_id,'total',g.total,'helpful',g.helpful,'unhelpful',g.unhelpful,'latest',g.latest) as payload,
        case $1->>'sort' when 'total' then g.total when 'helpful' then round(g.helpful::numeric/g.total,6) else 0 end as n,
        case when $1->>'sort'='page' then lower(coalesce(p.title,l.title,g.title)) else g.latest::text end as t
      from (select target_type,target_id,max(page_title) as title,count(*) as total,count(*) filter(where vote='yes') as helpful,count(*) filter(where vote='no') as unhelpful,max(created_at) as latest
        from public.db_feedback_events where created_at >= ($1->>'from')::timestamptz and created_at < ($1->>'to')::timestamptz and created_at <= ($1->>'asOf')::timestamptz
        and ($1->>'type'='all' or target_type=$1->>'type') group by target_type,target_id) g
      left join public.db_posts p on g.target_type='article' and p.id::text=g.target_id
      left join public.db_legals l on g.target_type='legal' and l.slug=g.target_id
      where ($1->>'query'='' or to_tsvector('simple',coalesce(p.title,l.title,g.title)) @@ websearch_to_tsquery('simple',$1->>'query'))
    $q$;
  elsif p_section = 'report_events' then
    source_sql := $q$
      select r.id::text as id,jsonb_build_object('id',r.id,'title',r.reason,'reason',r.reason,'details',r.details,'latest',r.created_at,'total',1) as payload,0::numeric as n,r.created_at::text as t
      from public.db_comment_reports r where r.comment_id=($1->>'id')::uuid and r.created_at <= ($1->>'asOf')::timestamptz
      and ($1->>'focus' is not null or (($1->>'from' is null or r.created_at >= ($1->>'from')::timestamptz) and r.created_at < ($1->>'to')::timestamptz))
      and ($1->>'reason'='' or r.reason=$1->>'reason') and ($1->>'focus' is null or r.id::text=$1->>'focus')
      and ($1->>'query'='' or to_tsvector('simple',coalesce(r.details,'')) @@ websearch_to_tsquery('simple',$1->>'query'))
    $q$;
  elsif p_section = 'feedback_events' then
    source_sql := $q$
      select f.id::text as id,jsonb_build_object('id',f.id,'title',f.page_title,'vote',f.vote,'latest',f.created_at,'total',1) as payload,0::numeric as n,f.created_at::text as t
      from public.db_feedback_events f where f.target_type || ':' || f.target_id=$1->>'id' and f.created_at <= ($1->>'asOf')::timestamptz
      and ($1->>'focus' is not null or (f.created_at >= ($1->>'from')::timestamptz and f.created_at < ($1->>'to')::timestamptz))
      and ($1->>'vote'='all' or f.vote=$1->>'vote') and ($1->>'focus' is null or f.id::text=$1->>'focus')
    $q$;
  elsif p_section in ('notifications','notification_events') then
    source_sql := $q$
      with matched as (
        select n.*, case when n.kind='comment_report' then coalesce(n.comment_id::text,n.id::text) when n.kind='comment_new' then coalesce(n.post_id::text,n.id::text) when n.kind in ('post_feedback','legal_feedback') then coalesce(n.meta->>'page_id',n.post_id::text,n.id::text) else n.id::text end as target,case when n.kind in ('post_feedback','legal_feedback') then n.meta->>'vote' else '' end as group_vote,(n.created_at at time zone ($1->>'timeZone'))::date as day
        from public.db_admin_notifications n where n.dismissed_at is null and n.created_at <= ($1->>'asOf')::timestamptz
        and ($1->>'from' is null or n.created_at >= ($1->>'from')::timestamptz) and n.created_at < ($1->>'to')::timestamptz
        and ($1->>'read'='all' or ($1->>'read'='read')=(n.read_at is not null))
        and ($1->>'type'='all' or n.kind=$1->>'type' or (n.kind in ('post_feedback','legal_feedback') and n.meta->>'vote'=case $1->>'type' when 'helpful' then 'yes' when 'unhelpful' then 'no' end))
        and ($1->>'query'='' or to_tsvector('simple',coalesce(n.meta->>'page_title','') || ' ' || coalesce(n.meta->>'author','') || ' ' || coalesce(n.meta->>'comment','') || ' ' || coalesce(n.meta->>'reason','') || ' ' || coalesce(n.meta->>'details','')) @@ websearch_to_tsquery('simple',$1->>'query'))
      )
    $q$;
    if p_section='notifications' then
      source_sql := source_sql || $q$
        , grouped as materialized (
          select jsonb_build_array(kind,target,group_vote,day)::text as id,coalesce(max(meta->>'page_title'),'Notification') as title,kind,group_vote as vote,count(*) as total,count(*) filter(where read_at is null) as unread,max(created_at) as latest
          from matched group by kind,target,group_vote,day
        ), ordered as (
          select *,case $1->>'sort' when 'type' then kind when 'page' then lower(title) else latest::text end as t from grouped
        )
      $q$;
      page_sql := source_sql || ', page as (select * from ordered order by t collate "C" ' || order_dir || ',id collate "C" ' || order_dir || ' offset ' || page_offset || ' limit ' || page_limit || ')
        select jsonb_build_object(''items'',coalesce((select jsonb_agg(to_jsonb(p)-''t'' order by t collate "C" ' || order_dir || ',id collate "C" ' || order_dir || ') from page p),''[]''::jsonb),''total'',(select count(*) from grouped),''page'',' || page_number || ',''asOf'',$1->>''asOf'')';
      execute page_sql using o into result;
      return result;
    else
      source_sql := source_sql || $q$
        select m.id::text as id,jsonb_build_object('id',m.id,'title',coalesce(m.meta->>'page_title','Notification'),'total',1,'latest',m.created_at,'event',to_jsonb(v)) as payload,0::numeric as n,m.created_at::text as t
        from matched m join public.db_admin_notification_items v on v.id=m.id where m.kind=($1->>'id')::jsonb->>0 and m.target=($1->>'id')::jsonb->>1 and m.group_vote is not distinct from (($1->>'id')::jsonb->>2) and m.day=(($1->>'id')::jsonb->>3)::date and ($1->>'focus' is null or m.id::text=$1->>'focus')
      $q$;
    end if;
  elsif p_section='comments' then
    source_sql := $q$
      select c.id::text as id,jsonb_build_object('id',c.id,'title',coalesce(c.author_name,'Anonymous'),'content',c.content,'total',1,'latest',c.created_at,'comment',jsonb_build_object('id',c.id,'post_id',c.post_id,'parent_id',c.parent_id,'author_name',c.author_name,'content',c.content,'is_anonymous',c.is_anonymous,'is_admin',c.is_admin,'is_approved',c.is_approved,'created_at',c.created_at,'reports',(select count(*) from public.db_comment_reports r where r.comment_id=c.id))) as payload,0::numeric as n,c.created_at::text as t
      from public.db_comments c where c.post_id=($1->>'id')::uuid and c.created_at <= ($1->>'asOf')::timestamptz and ($1->>'focus' is null or c.id::text=$1->>'focus') and ($1->>'reason'='' or exists(select 1 from public.db_comment_reports r where r.comment_id=c.id))
    $q$;
  else raise exception 'INVALID_SECTION';
  end if;
  page_sql := 'with source as not materialized (' || source_sql || '), page as (select * from source order by n ' || order_dir || ',t collate "C" ' || order_dir || ',id collate "C" ' || order_dir || ' offset ' || page_offset || ' limit ' || page_limit || ')
    select jsonb_build_object(''items'',coalesce((select jsonb_agg(payload order by n ' || order_dir || ',t collate "C" ' || order_dir || ',id collate "C" ' || order_dir || ') from page),''[]''::jsonb),
      ''total'',(select count(*) from source),''page'',' || page_number || ',''asOf'',$1->>''asOf'')';
  execute page_sql using o into result;
  if p_section='report_events' then
    result := result || jsonb_build_object('savedNotification',(select to_jsonb(n) from public.db_admin_notification_items n where n.id=(o->>'notificationId')::uuid),'context',(select jsonb_build_object('id',c.id,'postId',c.post_id,'title',p.title,'author',case when c.is_anonymous then 'Anonymous' else coalesce(c.author_name,'Anonymous') end,'content',c.content,'total',(select count(*) from public.db_comment_reports where comment_id=c.id)) from public.db_comments c join public.db_posts p on p.id=c.post_id where c.id=(o->>'id')::uuid),
      'reasons',(select coalesce(jsonb_agg(jsonb_build_object('reason',reason,'count',count)),'[]'::jsonb) from (select reason,count(*) from public.db_comment_reports where comment_id=(o->>'id')::uuid and created_at <= snapshot and (o->>'from' is null or created_at >= (o->>'from')::timestamptz) and created_at < (o->>'to')::timestamptz and (o->>'query'='' or to_tsvector('simple',coalesce(details,'')) @@ websearch_to_tsquery('simple',o->>'query')) group by reason) r));
  elsif p_section='feedback_events' and coalesce((o->>'meta')::boolean,true) then
    result := result || jsonb_build_object('series',public.db_admin_analytics((o->>'from')::timestamptz,(o->>'to')::timestamptz,o->>'timeZone',o->>'id'));
  end if;
  if p_section='feedback_events' then result := result || jsonb_build_object('context',context); end if;
  return result;
end;
$$;

create or replace function public.db_admin_clear_notifications(p_actor_id uuid, p_operation_id uuid, p_confirm boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_operation public.db_notification_clear_operations%rowtype; v_count integer;
begin
  if p_actor_id is null or p_operation_id is null then raise exception 'CLEAR_INVALID' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clear-notifications:' || p_operation_id::text, 0));
  select * into v_operation from public.db_notification_clear_operations where operation_id = p_operation_id;
  if found and v_operation.actor_id <> p_actor_id then raise exception 'CLEAR_OPERATION_CONFLICT' using errcode = '22023'; end if;
  if not found then
    if p_confirm then raise exception 'CLEAR_NOT_PREPARED' using errcode = '22023'; end if;
    insert into public.db_notification_clear_operations(operation_id, actor_id, target_ids)
      select p_operation_id, p_actor_id, coalesce(array_agg(id), '{}'::uuid[]) from public.db_admin_notifications where read_at is not null
      returning * into v_operation;
  end if;
  if p_confirm and v_operation.completed_at is null then
    delete from public.db_admin_notifications where id = any(v_operation.target_ids);
    get diagnostics v_count = row_count;
    update public.db_notification_clear_operations set completed_at = clock_timestamp(), deleted_count = v_count
      where operation_id = p_operation_id returning * into v_operation;
  end if;
  return jsonb_build_object('operationId', p_operation_id, 'count', cardinality(v_operation.target_ids),
    'completed', v_operation.completed_at is not null, 'deletedCount', v_operation.deleted_count);
end;
$$;
