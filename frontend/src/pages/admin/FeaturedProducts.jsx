import { useEffect, useState, useMemo, useContext, createContext } from 'react';
import {
  Button, Table, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, message, Divider, Upload, Switch, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, UploadOutlined, CopyOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../api/client';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const ICON_OPTIONS = [
  { value: 'lifestyle', label: 'Lifestyle (person)' },
  { value: 'travel', label: 'Travel (compass)' },
  { value: 'card', label: 'Card / Value' },
  { value: 'document', label: 'Document' },
];

const RowContext = createContext({});

function DragHandle() {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: 'move' }}
      ref={setActivatorNodeRef}
      {...listeners}
    />
  );
}

function SortableRow(props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });
  const style = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#fafafa' } : {}),
  };
  const contextValue = useMemo(() => ({ setActivatorNodeRef, listeners }), [setActivatorNodeRef, listeners]);
  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowContext.Provider>
  );
}

function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/featured-products');
      setProducts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isVisible: true, benefitSections: [], feesSections: [] });
    setFileList([]);
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    form.setFieldsValue({
      bankName: p.bankName,
      rankLabel: p.rankLabel || '',
      productTitle: p.productTitle,
      promoText: p.promoText || '',
      promoColor: p.promoColor || '',
      modalPromoText: p.modalPromoText || '',
      stat1Label: p.stat1Label || '',
      stat1Value: p.stat1Value || '',
      stat2Label: p.stat2Label || '',
      stat2Value: p.stat2Value || '',
      tagline: p.tagline || '',
      referUrl: p.referUrl || '',
      isVisible: p.isVisible !== false,
      benefitSections: p.benefitSections || [],
      feesSections: p.feesSections || [],
    });
    setFileList(
      p.image
        ? [{ uid: '-1', name: p.image, status: 'done', url: `${UPLOADS_BASE}/featured-products/${p.image}`, thumbUrl: `${UPLOADS_BASE}/featured-products/${p.image}` }]
        : []
    );
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const fd = new FormData();
      fd.append('bankName', values.bankName);
      fd.append('productTitle', values.productTitle);
      fd.append('rankLabel', values.rankLabel || '');
      fd.append('promoText', values.promoText || '');
      fd.append('promoColor', values.promoColor || '');
      fd.append('modalPromoText', values.modalPromoText || '');
      fd.append('stat1Label', values.stat1Label || '');
      fd.append('stat1Value', values.stat1Value || '');
      fd.append('stat2Label', values.stat2Label || '');
      fd.append('stat2Value', values.stat2Value || '');
      fd.append('tagline', values.tagline || '');
      fd.append('referUrl', values.referUrl || '');
      if (!editing) fd.append('order', products.length);
      fd.append('isVisible', values.isVisible !== false ? 'true' : 'false');
      fd.append('benefitSections', JSON.stringify(values.benefitSections || []));
      fd.append('feesSections', JSON.stringify(values.feesSections || []));

      const newFile = fileList.find((f) => f.originFileObj);
      if (newFile) fd.append('image', newFile.originFileObj);

      if (editing) {
        await api.put(`/featured-products/${editing._id}`, fd);
        message.success('Featured product updated');
      } else {
        await api.post('/featured-products', fd);
        message.success('Featured product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/featured-products/${id}`);
      message.success('Featured product deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const onDuplicate = async (id) => {
    try {
      await api.post(`/featured-products/${id}/duplicate`);
      message.success('Featured product duplicated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Duplicate failed');
    }
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setProducts((prev) => {
      const activeIndex = prev.findIndex((p) => p._id === active.id);
      const overIndex = prev.findIndex((p) => p._id === over.id);
      const next = arrayMove(prev, activeIndex, overIndex);
      api.post('/featured-products/reorder', { ids: next.map((p) => p._id) }).catch(() => {
        message.error('Reorder failed');
        load();
      });
      return next;
    });
  };

  const toggleVisible = async (row) => {
    try {
      const fd = new FormData();
      fd.append('isVisible', row.isVisible !== false ? 'false' : 'true');
      await api.put(`/featured-products/${row._id}`, fd);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const columns = [
    {
      key: 'sort',
      width: 40,
      render: () => <DragHandle />,
    },
    {
      title: 'Image',
      width: 70,
      render: (_, row) => row.image
        ? <img src={`${UPLOADS_BASE}/featured-products/${row.image}`} alt="" style={{ width: 52, height: 34, objectFit: 'contain', borderRadius: 4, border: '1px solid #e2e8f0' }} />
        : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>,
    },
    { title: 'Order', width: 70, render: (_, __, index) => index + 1 },
    { title: 'Bank', dataIndex: 'bankName' },
    { title: 'Title', dataIndex: 'productTitle', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Rank Label', dataIndex: 'rankLabel', render: (v) => v ? <Tag>{v}</Tag> : '—' },
    {
      title: 'Visible',
      dataIndex: 'isVisible',
      render: (v, row) => (
        <Switch checked={v !== false} checkedChildren="Visible" unCheckedChildren="Hidden" onChange={() => toggleVisible(row)} />
      ),
    },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Button icon={<CopyOutlined />} onClick={() => onDuplicate(row._id)}>Duplicate</Button>
          <Popconfirm title="Delete this featured product?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Featured Products</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Featured Product</Button>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Controls the "Top 3 customer's choice" section on the homepage. Drag rows by the handle to reorder; toggle Visible to show/hide on the site.
      </Typography.Text>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <DndContext modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={products.map((p) => p._id)} strategy={verticalListSortingStrategy}>
            <Table
              size="small"
              rowKey="_id"
              loading={loading}
              dataSource={products}
              columns={columns}
              components={{ body: { row: SortableRow } }}
              pagination={false}
            />
          </SortableContext>
        </DndContext>
      </div>

      <Modal
        title={editing ? 'Edit Featured Product' : 'Add Featured Product'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={760}
      >
        <Form form={form} layout="vertical">
          <Space size={16} align="start" style={{ display: 'flex' }}>
            <Form.Item name="bankName" label="Bank Name" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Input placeholder="e.g. First Abu Dhabi Bank" />
            </Form.Item>
            <Form.Item name="productTitle" label="Product Title" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
              <Input placeholder="e.g. FAB Z Card" />
            </Form.Item>
            <Form.Item name="rankLabel" label="Rank Label" style={{ flex: 1 }}>
              <Input placeholder="e.g. #02 · High demand" />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ display: 'flex' }}>
            <Form.Item name="isVisible" label="Visible on Website" valuePropName="checked" style={{ width: 160 }}>
              <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
            </Form.Item>
            <Form.Item label="Card / Modal Image" style={{ flex: 1 }}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                  return false;
                }}
                onRemove={() => { setFileList([]); return false; }}
                accept=".jpg,.jpeg,.png,.webp"
                maxCount={1}
              >
                {fileList.length === 0 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8, fontSize: 12 }}>Upload</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </Space>

          <Divider orientation="left" style={{ fontSize: 13 }}>Promo Badge</Divider>
          <Space size={16} align="start" style={{ display: 'flex' }}>
            <Form.Item name="promoText" label="Card Promo Text" style={{ flex: 1 }}>
              <Input placeholder="e.g. Save big on streaming, gaming & living, no annual fees!" />
            </Form.Item>
            <Form.Item name="modalPromoText" label="Modal Promo Text (optional, defaults to Card Promo Text)" style={{ flex: 1 }}>
              <Input placeholder="Leave blank to reuse Card Promo Text" />
            </Form.Item>
            <Form.Item name="promoColor" label="Promo Color (hex, optional)" style={{ width: 160 }}>
              <Input placeholder="#005a9c" />
            </Form.Item>
          </Space>

          <Divider orientation="left" style={{ fontSize: 13 }}>Key Stats</Divider>
          <Space size={16} align="start" style={{ display: 'flex' }}>
            <Form.Item name="stat1Label" label="Stat 1 Label" style={{ flex: 1 }}>
              <Input placeholder="e.g. Annual Fee" />
            </Form.Item>
            <Form.Item name="stat1Value" label="Stat 1 Value" style={{ flex: 1 }}>
              <Input placeholder="e.g. AED 100 (1st year free)" />
            </Form.Item>
            <Form.Item name="stat2Label" label="Stat 2 Label" style={{ flex: 1 }}>
              <Input placeholder="e.g. Interest Rate" />
            </Form.Item>
            <Form.Item name="stat2Value" label="Stat 2 Value" style={{ flex: 1 }}>
              <Input placeholder="e.g. 1.99%" />
            </Form.Item>
          </Space>

          <Space size={16} align="start" style={{ display: 'flex' }}>
            <Form.Item name="tagline" label="Tagline" style={{ flex: 1 }}>
              <Input placeholder="e.g. Free Careem Plus, 20% off Netflix & streaming, 0% FX fees & more." />
            </Form.Item>
            <Form.Item name="referUrl" label="Refer Now Link" style={{ flex: 1 }}>
              <Input placeholder="mysilah-redesign.html" />
            </Form.Item>
          </Space>

          <Divider orientation="left" style={{ fontSize: 13 }}>Modal — Product Benefits</Divider>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Wrap any part of a bullet in **double asterisks** to bold it, e.g. "**20% off** Netflix & streaming".
          </Typography.Text>
          <Form.List name="benefitSections">
            {(sections, { add: addSection, remove: removeSection }) => (
              <>
                {sections.map(({ key, name }) => (
                  <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <Space size={16} align="start" style={{ display: 'flex' }}>
                      <Form.Item name={[name, 'icon']} label="Icon" initialValue="card" style={{ width: 200 }}>
                        <Select options={ICON_OPTIONS} />
                      </Form.Item>
                      <Form.Item name={[name, 'title']} label="Section Title" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                        <Input placeholder="e.g. Lifestyle Benefits" />
                      </Form.Item>
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeSection(name)} style={{ marginTop: 28 }} />
                    </Space>
                    <Form.List name={[name, 'bullets']}>
                      {(bullets, { add: addBullet, remove: removeBullet }) => (
                        <>
                          {bullets.map(({ key: bKey, name: bName }) => (
                            <Space key={bKey} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                              <Form.Item name={bName} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, width: 500 }}>
                                <Input placeholder="Bullet text, use **bold** where needed" />
                              </Form.Item>
                              <MinusCircleOutlined onClick={() => removeBullet(bName)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                            </Space>
                          ))}
                          <Button type="dashed" size="small" onClick={() => addBullet()} icon={<PlusOutlined />}>Add Bullet</Button>
                        </>
                      )}
                    </Form.List>
                  </div>
                ))}
                <Button type="dashed" onClick={() => addSection({ icon: 'card', title: '', bullets: [] })} icon={<PlusOutlined />} block>
                  Add Benefit Section
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" style={{ fontSize: 13 }}>Modal — Fees &amp; Eligibility</Divider>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Add sections for the Fees &amp; Eligibility tab, each as a bullet list (e.g. "Eligibility", "Annual Fee Waiver") or a two-column table (e.g. "Key Terms", "Fees &amp; Charges"). Wrap bullet text in **double asterisks** to bold it.
          </Typography.Text>
          <Form.List name="feesSections">
            {(sections, { add: addSection, remove: removeSection }) => (
              <>
                {sections.map(({ key, name }) => (
                  <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <Space size={16} align="start" style={{ display: 'flex' }}>
                      <Form.Item name={[name, 'icon']} label="Icon" initialValue="card" style={{ width: 180 }}>
                        <Select options={ICON_OPTIONS} />
                      </Form.Item>
                      <Form.Item name={[name, 'title']} label="Section Title" rules={[{ required: true, message: 'Required' }]} style={{ flex: 1 }}>
                        <Input placeholder='e.g. "Key Terms" or "Eligibility"' />
                      </Form.Item>
                      <Form.Item name={[name, 'type']} label="Type" initialValue="bullets" style={{ width: 170 }}>
                        <Select options={[{ value: 'bullets', label: 'Bullet List' }, { value: 'table', label: 'Table (label/value)' }]} />
                      </Form.Item>
                      <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeSection(name)} style={{ marginTop: 28 }} />
                    </Space>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) =>
                        prev.feesSections?.[name]?.type !== cur.feesSections?.[name]?.type
                      }
                    >
                      {({ getFieldValue }) => {
                        const type = getFieldValue(['feesSections', name, 'type']) || 'bullets';
                        return type === 'table' ? (
                          <Form.List name={[name, 'rows']}>
                            {(rows, { add: addRow, remove: removeRow }) => (
                              <>
                                {rows.map(({ key: rKey, name: rName }) => (
                                  <Space key={rKey} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                    <Form.Item name={[rName, 'label']} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, width: 260 }}>
                                      <Input placeholder="e.g. Minimum Salary" />
                                    </Form.Item>
                                    <Form.Item name={[rName, 'value']} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, width: 260 }}>
                                      <Input placeholder="e.g. AED 5,000" />
                                    </Form.Item>
                                    <MinusCircleOutlined onClick={() => removeRow(rName)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                                  </Space>
                                ))}
                                <Button type="dashed" size="small" onClick={() => addRow()} icon={<PlusOutlined />}>Add Row</Button>
                              </>
                            )}
                          </Form.List>
                        ) : (
                          <Form.List name={[name, 'bullets']}>
                            {(bullets, { add: addBullet, remove: removeBullet }) => (
                              <>
                                {bullets.map(({ key: bKey, name: bName }) => (
                                  <Space key={bKey} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                                    <Form.Item name={bName} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0, width: 500 }}>
                                      <Input placeholder="Bullet text, use **bold** where needed" />
                                    </Form.Item>
                                    <MinusCircleOutlined onClick={() => removeBullet(bName)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                                  </Space>
                                ))}
                                <Button type="dashed" size="small" onClick={() => addBullet()} icon={<PlusOutlined />}>Add Bullet</Button>
                              </>
                            )}
                          </Form.List>
                        );
                      }}
                    </Form.Item>
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => addSection({ icon: 'card', title: '', type: 'bullets', bullets: [], rows: [] })}
                  icon={<PlusOutlined />}
                  block
                >
                  Add Fees &amp; Eligibility Section
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}

export default FeaturedProducts;
