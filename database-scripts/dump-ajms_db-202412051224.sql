--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2024-12-05 12:24:22

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 4915 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 16496)
-- Name: account_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_list (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    status boolean DEFAULT true NOT NULL,
    delete_flag boolean DEFAULT false NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone,
    user_id integer,
    balance real DEFAULT 0 NOT NULL,
    financial_year character varying(10) NOT NULL
);


ALTER TABLE public.account_list OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16495)
-- Name: account_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_list_id_seq OWNER TO postgres;

--
-- TOC entry 4916 (class 0 OID 0)
-- Dependencies: 223
-- Name: account_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_list_id_seq OWNED BY public.account_list.id;


--
-- TOC entry 226 (class 1259 OID 16514)
-- Name: group_list; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.group_list (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    status boolean DEFAULT true NOT NULL,
    delete_flag boolean DEFAULT false NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone,
    user_id integer
);


ALTER TABLE public.group_list OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16513)
-- Name: group_list_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.group_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.group_list_id_seq OWNER TO postgres;

--
-- TOC entry 4917 (class 0 OID 0)
-- Dependencies: 225
-- Name: group_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.group_list_id_seq OWNED BY public.group_list.id;


--
-- TOC entry 222 (class 1259 OID 16470)
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id integer NOT NULL,
    code character varying(100) NOT NULL,
    journal_date date NOT NULL,
    description text NOT NULL,
    user_id integer,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16469)
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.journal_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journal_entries_id_seq OWNER TO postgres;

--
-- TOC entry 4918 (class 0 OID 0)
-- Dependencies: 221
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- TOC entry 227 (class 1259 OID 16530)
-- Name: journal_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_items (
    journal_id integer NOT NULL,
    account_id integer NOT NULL,
    group_id integer NOT NULL,
    amount real DEFAULT 0 NOT NULL,
    date_created timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type boolean DEFAULT true NOT NULL
);


ALTER TABLE public.journal_items OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16455)
-- Name: system_info; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_info (
    id integer NOT NULL,
    meta_field text NOT NULL,
    meta_value text NOT NULL
);


ALTER TABLE public.system_info OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16454)
-- Name: system_info_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_info_id_seq OWNER TO postgres;

--
-- TOC entry 4919 (class 0 OID 0)
-- Dependencies: 219
-- Name: system_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_info_id_seq OWNED BY public.system_info.id;


--
-- TOC entry 218 (class 1259 OID 16443)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    firstname character varying(250) NOT NULL,
    middlename text,
    lastname character varying(250) NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    avatar text,
    last_login timestamp without time zone,
    type boolean DEFAULT false NOT NULL,
    status boolean DEFAULT true NOT NULL,
    date_added timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_updated timestamp without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16442)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4920 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4726 (class 2604 OID 16499)
-- Name: account_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_list ALTER COLUMN id SET DEFAULT nextval('public.account_list_id_seq'::regclass);


--
-- TOC entry 4731 (class 2604 OID 16517)
-- Name: group_list id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_list ALTER COLUMN id SET DEFAULT nextval('public.group_list_id_seq'::regclass);


--
-- TOC entry 4724 (class 2604 OID 16473)
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- TOC entry 4723 (class 2604 OID 16458)
-- Name: system_info id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_info ALTER COLUMN id SET DEFAULT nextval('public.system_info_id_seq'::regclass);


--
-- TOC entry 4719 (class 2604 OID 16446)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4906 (class 0 OID 16496)
-- Dependencies: 224
-- Data for Name: account_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_list (id, name, description, status, delete_flag, date_created, date_updated, user_id, balance, financial_year) FROM stdin;
51	ICICI bank		t	f	2024-05-26 13:54:06	2024-12-03 22:42:50	6	0	24-25
52	JOSHNA ENTERPRISES		t	f	2024-05-26 13:55:10	2024-12-03 22:42:50	6	0	24-25
53	KALYAN AQUA		t	f	2024-05-26 18:44:12	2024-12-03 22:42:50	6	0	24-25
54	Mannem Bhadraiah		t	f	2024-05-26 19:17:30	2024-12-03 22:42:50	6	0	24-25
55	K Navya		t	f	2024-05-26 19:19:38	2024-12-03 22:42:50	6	0	24-25
56	Bank Charges		t	f	2024-05-26 19:21:30	2024-12-03 23:39:43	6	0	24-25
57	SBI		t	t	2024-05-28 22:55:51	2024-12-03 22:42:50	6	0	24-25
58	AXIS		t	t	2024-12-03 22:44:51	2024-12-03 23:39:28	6	20000.2	
59	CANARA	canara bank	t	t	2024-12-03 23:00:44	2024-12-03 23:39:33	6	242423	
\.


--
-- TOC entry 4908 (class 0 OID 16514)
-- Dependencies: 226
-- Data for Name: group_list; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.group_list (id, name, description, status, delete_flag, date_created, date_updated, user_id) FROM stdin;
8	BANKS		t	f	2024-05-26 13:51:20	2024-05-28 22:09:31	6
9	Sundry Debtors		t	f	2024-05-26 13:54:31	2024-05-28 22:09:31	6
10	Sundry Creditors		t	f	2024-05-26 19:17:48	2024-05-28 22:09:31	6
11	Indirect Expenses		t	f	2024-05-26 19:21:15	2024-05-28 22:09:31	6
12	CASH		t	t	2024-05-28 22:31:11	2024-05-28 22:36:00	6
13	CASH1		t	t	2024-05-28 22:32:41	2024-05-28 22:36:05	6
14	CASH2		t	t	2024-05-28 22:34:06	2024-05-28 22:36:09	6
15	CASH12		t	t	2024-05-28 22:37:17	2024-05-28 22:39:30	6
\.


--
-- TOC entry 4904 (class 0 OID 16470)
-- Dependencies: 222
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_entries (id, code, journal_date, description, user_id, date_created, date_updated) FROM stdin;
16	202405-00003	2024-04-12		6	2024-05-26 19:10:44	\N
17	202405-00004	2024-04-15		6	2024-05-26 19:12:11	\N
18	202405-00005	2024-04-18		6	2024-05-26 19:13:50	\N
19	202405-00006	2024-04-18		6	2024-05-26 19:16:26	\N
20	202405-00007	2024-04-18		6	2024-05-26 19:19:02	\N
21	202405-00008	2024-04-20		6	2024-05-26 19:20:25	\N
22	202405-00009	2024-04-30		6	2024-05-26 19:22:14	\N
24	202405-00001	2024-05-30	sms charges	6	2024-05-29 22:16:11	\N
25	202405-00010	2024-04-06	IMPS	6	2024-05-29 23:11:45	\N
26	202405-00002	2024-04-06	IMPS	6	2024-05-29 23:14:11	\N
\.


--
-- TOC entry 4909 (class 0 OID 16530)
-- Dependencies: 227
-- Data for Name: journal_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_items (journal_id, account_id, group_id, amount, date_created, type) FROM stdin;
16	53	9	699193	2024-05-26 19:10:44	f
16	51	8	699193	2024-05-26 19:10:44	t
17	51	8	699500	2024-05-26 19:12:11	f
17	52	9	699500	2024-05-26 19:12:11	t
18	52	9	85000	2024-05-26 19:13:50	f
18	51	8	85000	2024-05-26 19:13:50	t
19	52	9	85000	2024-05-26 19:16:26	t
19	51	8	85000	2024-05-26 19:16:26	f
19	52	9	515000	2024-05-26 19:16:26	f
19	51	8	515000	2024-05-26 19:16:26	t
20	54	10	500000	2024-05-26 19:19:02	t
20	51	8	500000	2024-05-26 19:19:02	f
21	55	10	15000	2024-05-26 19:20:25	t
21	51	8	15000	2024-05-26 19:20:25	f
22	56	11	45.42	2024-05-26 19:22:14	t
22	51	8	45.42	2024-05-26 19:22:14	f
24	56	11	1.59	2024-05-29 22:16:11	t
24	51	8	1.59	2024-05-29 22:16:11	f
25	51	8	30000	2024-05-29 23:11:45	f
25	52	9	30000	2024-05-29 23:11:45	t
26	51	8	30000	2024-05-29 23:14:11	t
26	52	9	30000	2024-05-29 23:14:11	f
\.


--
-- TOC entry 4902 (class 0 OID 16455)
-- Dependencies: 220
-- Data for Name: system_info; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_info (id, meta_field, meta_value) FROM stdin;
1	name	Accounting Journal Management System
6	short_name	AJMS - PHP
11	logo	uploads/logo-1643680475.png
13	user_avatar	uploads/user_avatar.jpg
14	cover	uploads/cover-1643680511.png
15	content	Array
16	email	info@xyzcompany.com
17	contact	09854698789 / 78945632
18	from_time	11:00
19	to_time	21:30
20	address	XYZ Street, There City, Here, 2306
\.


--
-- TOC entry 4900 (class 0 OID 16443)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, firstname, middlename, lastname, username, password, avatar, last_login, type, status, date_added, date_updated) FROM stdin;
1	Administrator	\N	Admin	admin	0192023a7bbd73250516f069df18b500	uploads/avatar-1.png?v=1643703899	\N	t	t	2021-01-20 14:02:37	2022-02-01 16:24:59
6	sri manikanta aqua traders	\N	bhargavi	bhargavi	6b1049159fb98132913a5e5b8bde49bd	\N	\N	t	t	2024-05-26 13:47:49	2024-12-03 17:33:51
\.


--
-- TOC entry 4921 (class 0 OID 0)
-- Dependencies: 223
-- Name: account_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.account_list_id_seq', 1, false);


--
-- TOC entry 4922 (class 0 OID 0)
-- Dependencies: 225
-- Name: group_list_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.group_list_id_seq', 1, false);


--
-- TOC entry 4923 (class 0 OID 0)
-- Dependencies: 221
-- Name: journal_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.journal_entries_id_seq', 1, false);


--
-- TOC entry 4924 (class 0 OID 0)
-- Dependencies: 219
-- Name: system_info_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_info_id_seq', 1, false);


--
-- TOC entry 4925 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 4745 (class 2606 OID 16507)
-- Name: account_list account_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_list
    ADD CONSTRAINT account_list_pkey PRIMARY KEY (id);


--
-- TOC entry 4747 (class 2606 OID 16524)
-- Name: group_list group_list_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_list
    ADD CONSTRAINT group_list_pkey PRIMARY KEY (id);


--
-- TOC entry 4743 (class 2606 OID 16478)
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 4741 (class 2606 OID 16462)
-- Name: system_info system_info_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_info
    ADD CONSTRAINT system_info_pkey PRIMARY KEY (id);


--
-- TOC entry 4739 (class 2606 OID 16453)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4749 (class 2606 OID 16508)
-- Name: account_list account_list_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_list
    ADD CONSTRAINT account_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4750 (class 2606 OID 16525)
-- Name: group_list group_list_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.group_list
    ADD CONSTRAINT group_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4748 (class 2606 OID 16479)
-- Name: journal_entries journal_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4751 (class 2606 OID 16541)
-- Name: journal_items journal_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account_list(id) ON DELETE CASCADE;


--
-- TOC entry 4752 (class 2606 OID 16546)
-- Name: journal_items journal_items_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.group_list(id) ON DELETE CASCADE;


--
-- TOC entry 4753 (class 2606 OID 16536)
-- Name: journal_items journal_items_journal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_items
    ADD CONSTRAINT journal_items_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


-- Completed on 2024-12-05 12:24:23

--
-- PostgreSQL database dump complete
--

