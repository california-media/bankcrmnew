import { useEffect, useState } from 'react';
import {
  Table, Button, Drawer, Form, Input, Select, Switch, Popconfirm,
  Tag, Space, Typography, DatePicker, InputNumber, message, Upload, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, GlobalOutlined,
  UploadOutlined, SettingOutlined, CloseOutlined, CheckOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';
import QuillEditor from '../../components/QuillEditor';

const { Title, Text } = Typography;
const { TextArea } = Input;

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const COLOR_OPTIONS = [
  { label: 'Violet',  value: 'violet',  hex: '#7C3AED' },
  { label: 'Blue',    value: 'blue',    hex: '#0EA5E9' },
  { label: 'Green',   value: 'green',   hex: '#10A36A' },
  { label: 'Orange',  value: 'orange',  hex: '#F97316' },
  { label: 'Teal',    value: 'teal',    hex: '#0D9488' },
  { label: 'Red',     value: 'red',     hex: '#EF4444' },
  { label: 'Pink',    value: 'pink',    hex: '#EC4899' },
];

const COLOR_MAP = Object.fromEntries(COLOR_OPTIONS.map((c) => [c.value, c.hex]));

const ANT_COLOR = {
  violet: 'purple', blue: 'blue', green: 'green',
  orange: 'orange', teal: 'cyan', red: 'red', pink: 'magenta',
};


export default function AdminBlog() {
  const [posts,        setPosts]        = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [fileList,         setFileList]         = useState([]);
  const [detailFileList,   setDetailFileList]   = useState([]);
  const [detailImageAlts,  setDetailImageAlts]  = useState({});
  const [contentHtml,    setContentHtml]    = useState('');
  const [catName,      setCatName]      = useState('');
  const [catColor,     setCatColor]     = useState('violet');
  const [catImageFile, setCatImageFile] = useState(null);
  const [catImageList, setCatImageList] = useState([]);
  const [catSaving,    setCatSaving]    = useState(false);
  const [editingCat,   setEditingCat]   = useState(null);
  const [form]                          = Form.useForm();

  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editors,          setEditors]         = useState([]);
  const [editorForm]                           = Form.useForm();
  const [editorSaving,     setEditorSaving]    = useState(false);

  const fetchEditors = async () => {
    try { const { data } = await api.get('/admin/blog-editors'); setEditors(data); } catch {}
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/blogs');
      setPosts(data);
    } catch {
      message.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/blog-categories');
      setCategories(data);
    } catch {
      message.error('Failed to load categories');
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchCategories();
    fetchEditors();
  }, []);

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.name }));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ iconType: 'pen', readTime: 3, sortOrder: 0, isPublished: false });
    setFileList([]);
    setDetailFileList([]);
    setDetailImageAlts({});
    setContentHtml('');
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title:         record.title,
      excerpt:       record.excerpt,
      category:      record.category,
      publishedDate: record.publishedDate ? dayjs(record.publishedDate) : null,
      readTime:         record.readTime,
      iconType:         record.iconType || 'pen',
      isPublished:      record.isPublished,
      sortOrder:        record.sortOrder ?? 0,
      metaTitle:        record.metaTitle || '',
      metaDescription:  record.metaDescription || '',
      coverImageAlt:    record.coverImageAlt || '',
    });
    setContentHtml(record.content || '');
    setFileList(
      record.coverImage
        ? [{ uid: '-1', name: record.coverImage, status: 'done', url: `${UPLOADS_BASE}/blog-images/${record.coverImage}` }]
        : []
    );
    const dfl = (record.detailImages || []).map((img, i) => ({
      uid: `-detail-${i}`,
      name: img,
      status: 'done',
      url: `${UPLOADS_BASE}/blog-images/${img}`,
    }));
    setDetailFileList(dfl);
    const alts = {};
    dfl.forEach((f, i) => { alts[f.uid] = (record.detailImageAlts || [])[i] || ''; });
    setDetailImageAlts(alts);
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    const fd = new FormData();
    fd.append('title',         values.title);
    fd.append('excerpt',       values.excerpt);
    fd.append('category',      values.category);
    fd.append('readTime',      values.readTime ?? 3);
    fd.append('iconType',      values.iconType ?? 'pen');
    fd.append('isPublished',   values.isPublished ? 'true' : 'false');
    fd.append('sortOrder',     values.sortOrder ?? 0);
    fd.append('content',       contentHtml);
    if (values.publishedDate)   fd.append('publishedDate',    values.publishedDate.toISOString());
    if (values.metaTitle)       fd.append('metaTitle',        values.metaTitle);
    if (values.metaDescription) fd.append('metaDescription',  values.metaDescription);
    if (values.coverImageAlt)   fd.append('coverImageAlt',    values.coverImageAlt);

    const newFile = fileList.find((f) => f.originFileObj);
    if (newFile) fd.append('coverImage', newFile.originFileObj);

    // Existing detail images to preserve
    const keptFiles = detailFileList.filter(f => !f.originFileObj);
    const newFiles  = detailFileList.filter(f => f.originFileObj);
    keptFiles.forEach(f => fd.append('keepDetailImages', f.name));
    newFiles.forEach(f => fd.append('detailImages', f.originFileObj));
    // Alt tags in same order as final images: kept first, then new
    const orderedAlts = [...keptFiles, ...newFiles].map(f => detailImageAlts[f.uid] || '');
    fd.append('detailImageAlts', JSON.stringify(orderedAlts));

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/blogs/${editing._id}`, fd);
        message.success('Post updated');
      } else {
        await api.post('/blogs', fd);
        message.success('Post created');
      }
      setDrawerOpen(false);
      fetchPosts();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/blogs/${id}`);
      message.success('Post deleted');
      fetchPosts();
    } catch {
      message.error('Delete failed');
    }
  };

  const togglePublish = async (record) => {
    const fd = new FormData();
    fd.append('isPublished', (!record.isPublished).toString());
    try {
      await api.put(`/blogs/${record._id}`, fd);
      fetchPosts();
    } catch {
      message.error('Update failed');
    }
  };

  const addCategory = async () => {
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', catName.trim());
      fd.append('color', catColor);
      if (catImageFile) fd.append('image', catImageFile);
      await api.post('/blog-categories', fd);
      message.success('Category added');
      setCatName('');
      setCatImageFile(null);
      setCatImageList([]);
      fetchCategories();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setCatSaving(false);
    }
  };

  const startEditCat = (cat) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatColor(cat.color || 'violet');
    setCatImageFile(null);
    setCatImageList(
      cat.image
        ? [{ uid: '-cat-img', name: cat.image, status: 'done', url: `${UPLOADS_BASE}/blog-category-images/${cat.image}`, thumbUrl: `${UPLOADS_BASE}/blog-category-images/${cat.image}` }]
        : []
    );
  };

  const cancelEditCat = () => {
    setEditingCat(null);
    setCatName('');
    setCatColor('violet');
    setCatImageFile(null);
    setCatImageList([]);
  };

  const updateCategory = async () => {
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', catName.trim());
      fd.append('color', catColor);
      if (catImageFile) fd.append('image', catImageFile);
      await api.put(`/blog-categories/${editingCat._id}`, fd);
      message.success('Category updated');
      cancelEditCat();
      fetchCategories();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id) => {
    try {
      await api.delete(`/blog-categories/${id}`);
      fetchCategories();
    } catch {
      message.error('Delete failed');
    }
  };

  const getCategoryColor = (name) => {
    const cat = categories.find((c) => c.name === name);
    return cat ? (ANT_COLOR[cat.color] || 'default') : 'default';
  };

  const columns = [
    {
      title: 'Cover',
      width: 72,
      render: (_, row) =>
        row.coverImage
          ? <img src={`${UPLOADS_BASE}/blog-images/${row.coverImage}`} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
          : <div style={{ width: 60, height: 40, borderRadius: 6, background: 'linear-gradient(135deg,#7C3AED,#0EA5E9)', opacity: 0.25 }} />,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      render: (text, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {row.slug && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{row.slug}</div>}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 120,
      render: (cat) => (
        <Tag color={getCategoryColor(cat)} style={{ textTransform: 'capitalize' }}>{cat}</Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'publishedDate',
      width: 110,
      render: (d) => d ? dayjs(d).format('MMM D, YYYY') : '—',
    },
    {
      title: 'Read',
      dataIndex: 'readTime',
      width: 70,
      render: (m) => `${m} min`,
    },
    {
      title: 'Published',
      dataIndex: 'isPublished',
      width: 110,
      render: (val, record) => (
        <Switch size="small" checked={val} onChange={() => togglePublish(record)} checkedChildren="Live" unCheckedChildren="Draft" />
      ),
    },
    {
      title: '',
      width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this post?" onConfirm={() => handleDelete(record._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const published = posts.filter((p) => p.isPublished).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Blog Posts</Title>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {published} published · {posts.length - published} draft
          </div>
        </div>
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => { setEditorModalOpen(true); fetchEditors(); }}>
            Blog Editors
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => setCatModalOpen(true)}>
            Manage Categories
          </Button>
          <Button icon={<GlobalOutlined />} href="https://mysilah.ae/#blog" target="_blank" rel="noopener noreferrer">
            View on Site
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Post</Button>
        </Space>
      </div>

      <Table
        dataSource={posts}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
      />

      {/* ── Category Management Modal ── */}
      <Modal
        title="Manage Categories"
        open={catModalOpen}
        onCancel={() => { setCatModalOpen(false); cancelEditCat(); }}
        footer={null}
        width={480}
      >
        {/* Add / Edit row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <Input
            placeholder="Category name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            onPressEnter={editingCat ? updateCategory : addCategory}
            style={{ flex: 1 }}
          />
          <Select
            value={catColor}
            onChange={setCatColor}
            style={{ width: 110 }}
            options={COLOR_OPTIONS.map((c) => ({
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.hex, display: 'inline-block', flexShrink: 0 }} />
                  {c.label}
                </span>
              ),
              value: c.value,
            }))}
          />
          {editingCat ? (
            <Space size={4}>
              <Button type="primary" icon={<CheckOutlined />} onClick={updateCategory} loading={catSaving}>Save</Button>
              <Button icon={<CloseOutlined />} onClick={cancelEditCat}>Cancel</Button>
            </Space>
          ) : (
            <Button type="primary" icon={<PlusOutlined />} onClick={addCategory} loading={catSaving}>Add</Button>
          )}
        </div>
        <div style={{ marginBottom: 20 }}>
          <Upload
            listType="picture"
            fileList={catImageList}
            beforeUpload={(file) => {
              setCatImageFile(file);
              setCatImageList([{ uid: file.uid, name: file.name, status: 'done', thumbUrl: URL.createObjectURL(file) }]);
              return false;
            }}
            onRemove={() => { setCatImageFile(null); setCatImageList([]); return false; }}
            accept=".jpg,.jpeg,.png,.webp,.avif"
            maxCount={1}
          >
            {catImageList.length === 0 && (
              <Button icon={<UploadOutlined />} size="small">Category Image (optional)</Button>
            )}
          </Upload>
          <Text type="secondary" style={{ fontSize: 11 }}>Shown as hero on detail page and as card image on listing</Text>
        </div>

        {/* List */}
        {categories.length === 0 && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
            No categories yet. Add one above.
          </Text>
        )}
        {categories.map((cat) => (
          <div
            key={cat._id}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_MAP[cat.color] || '#7C3AED', display: 'inline-block', flexShrink: 0 }} />
              {cat.image && (
                <img
                  src={`${UPLOADS_BASE}/blog-category-images/${cat.image}`}
                  alt=""
                  style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                />
              )}
              <span style={{ fontWeight: 500 }}>{cat.name}</span>
            </div>
            <Space size={4}>
              <Button size="small" icon={<EditOutlined />} type="text" onClick={() => startEditCat(cat)} />
              <Popconfirm title="Delete this category?" onConfirm={() => deleteCategory(cat._id)} okText="Delete" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />} type="text" />
              </Popconfirm>
            </Space>
          </div>
        ))}
      </Modal>

      {/* ── Blog Editors Modal ── */}
      <Modal
        title={<span><TeamOutlined /> Blog Editors</span>}
        open={editorModalOpen}
        onCancel={() => { setEditorModalOpen(false); editorForm.resetFields(); }}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={editorForm}
          layout="vertical"
          onFinish={async (values) => {
            setEditorSaving(true);
            try {
              await api.post('/admin/blog-editors', values);
              message.success('Blog editor created');
              editorForm.resetFields();
              fetchEditors();
            } catch (err) {
              message.error(err.response?.data?.message || 'Failed');
            } finally { setEditorSaving(false); }
          }}
        >
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Blog editors can create, edit, and publish blog posts. They cannot access leads or financial data.
          </div>
          <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
            <Input prefix={<UserOutlined />} placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]} style={{ marginBottom: 10 }}>
            <Input placeholder="editor@company.ae" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]} style={{ marginBottom: 14 }}>
            <Input.Password placeholder="Temporary password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={editorSaving} block>Create Blog Editor</Button>
        </Form>

        {editors.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 }}>EXISTING EDITORS</div>
            {editors.map((e) => (
              <div key={e._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{e.email}</div>
                </div>
                <Popconfirm
                  title="Remove this blog editor?"
                  onConfirm={async () => {
                    try { await api.delete(`/admin/blog-editors/${e._id}`); fetchEditors(); message.success('Removed'); }
                    catch { message.error('Failed'); }
                  }}
                  okText="Remove" okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger type="text" icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── Post Drawer ── */}
      <Drawer
        title={editing ? 'Edit Blog Post' : 'New Blog Post'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSubmit}>
              {editing ? 'Save Changes' : 'Create Post'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form form={form} layout="vertical">

          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title required' }]}>
            <Input placeholder="e.g. How to Close More Credit Card Referrals in the UAE" />
          </Form.Item>

          <Form.Item name="excerpt" label="Excerpt" rules={[{ required: true, message: 'Excerpt required' }]}>
            <TextArea rows={2} placeholder="Short description shown on the blog card (1-2 sentences)" style={{ resize: 'none' }} />
          </Form.Item>

          {/* Cover Image */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Cover Image" tooltip="Shown on blog listing cards">
              <Upload
                listType="picture-card"
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                  return false;
                }}
                onRemove={() => { setFileList([]); return false; }}
                accept=".jpg,.jpeg,.png,.webp,.avif"
                maxCount={1}
              >
                {fileList.length === 0 && (
                  <div><UploadOutlined /><div style={{ marginTop: 8, fontSize: 12 }}>Upload</div></div>
                )}
              </Upload>
              <Text type="secondary" style={{ fontSize: 12 }}>Shown on blog cards</Text>
            </Form.Item>

            <Form.Item label="Detail Page Images" tooltip="Images shown on the blog detail page (first is hero)">
              <Upload
                listType="picture-card"
                fileList={detailFileList}
                beforeUpload={(file) => {
                  setDetailFileList(prev => [...prev, { uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                  setDetailImageAlts(prev => ({ ...prev, [file.uid]: '' }));
                  return false;
                }}
                onRemove={(file) => {
                  setDetailFileList(prev => prev.filter(f => f.uid !== file.uid));
                  setDetailImageAlts(prev => { const n = { ...prev }; delete n[file.uid]; return n; });
                  return false;
                }}
                accept=".jpg,.jpeg,.png,.webp,.avif"
                multiple
              >
                {detailFileList.length < 10 && (
                  <div><UploadOutlined /><div style={{ marginTop: 8, fontSize: 12 }}>Upload</div></div>
                )}
              </Upload>
              <Text type="secondary" style={{ fontSize: 12 }}>Shown on detail page · first image = hero</Text>
              {detailFileList.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detailFileList.map((f, i) => (
                    <div key={f.uid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img
                        src={f.url || (f.originFileObj ? URL.createObjectURL(f.originFileObj) : '')}
                        alt=""
                        style={{ width: 40, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }}
                      />
                      <Input
                        size="small"
                        placeholder={`Alt tag for image ${i + 1}`}
                        value={detailImageAlts[f.uid] || ''}
                        onChange={(e) => setDetailImageAlts(prev => ({ ...prev, [f.uid]: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Form.Item>
          </div>

          {/* Category */}
          <Form.Item
            name="category"
            label={
              <span>
                Category
                <Button
                  type="link"
                  size="small"
                  icon={<SettingOutlined />}
                  style={{ padding: '0 4px', marginLeft: 4, fontSize: 12 }}
                  onClick={() => { setDrawerOpen(false); setCatModalOpen(true); }}
                >
                  Manage
                </Button>
              </span>
            }
            rules={[{ required: true, message: 'Category required' }]}
          >
            <Select
              options={categoryOptions}
              placeholder={categories.length ? 'Select category' : 'Add categories first →'}
              notFoundContent={
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  No categories — click Manage to add one.
                </span>
              }
            />
          </Form.Item>

          {/* Meta row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="publishedDate" label="Publish Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="readTime" label="Read Time (min)">
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort Order" tooltip="Lower = first">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="isPublished" label="Status" valuePropName="checked">
              <Switch checkedChildren="Published" unCheckedChildren="Draft" style={{ marginTop: 4 }} />
            </Form.Item>
          </div>

          {/* SEO */}
          <div style={{ background: '#f8f7ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 12, letterSpacing: 0.5 }}>SEO</div>
            <Form.Item name="metaTitle" label="Meta Title" style={{ marginBottom: 10 }} extra="Overrides browser tab title. 50–60 chars ideal.">
              <Input placeholder="e.g. How to Close More Referrals in UAE | MySilah" maxLength={100} showCount />
            </Form.Item>
            <Form.Item name="metaDescription" label="Meta Description" style={{ marginBottom: 10 }} extra="Shown in Google search snippets. 150–160 chars ideal.">
              <TextArea rows={2} placeholder="A brief description for search engines…" maxLength={200} showCount style={{ resize: 'none' }} />
            </Form.Item>
            <Form.Item name="coverImageAlt" label="Cover Image Alt Tag" style={{ marginBottom: 0 }} extra="Describes the cover image for screen readers and Google Images.">
              <Input placeholder="e.g. UAE credit card referral agent reviewing applications" maxLength={150} />
            </Form.Item>
          </div>

          {/* Content editor */}
          <Form.Item label="Article Content">
            <QuillEditor
              value={contentHtml}
              onChange={setContentHtml}
              style={{ minHeight: 320, borderRadius: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              Full article body shown on the blog detail page.
            </Text>
          </Form.Item>

        </Form>
      </Drawer>
    </div>
  );
}
