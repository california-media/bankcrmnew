import { Fragment, useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, InputNumber, Space, Dropdown, Tag, message, Typography, Radio, Tooltip } from 'antd';
import { PlusOutlined, DownloadOutlined, CheckOutlined, StopOutlined, DeleteOutlined, MinusCircleOutlined, EyeOutlined, MoreOutlined, ExclamationCircleFilled, SettingOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons';
import api from '../../api/client';
import InvoiceNotesModal from '../../components/InvoiceNotesModal';

const STATUS_COLORS = { unpaid: 'orange', paid: 'green', cancelled: 'default' };

// Same wording as leadLineDescription in backend/controllers/invoice.controller.js.
const PRODUCT_TYPE_LABELS = { credit_card: 'Credit Card', loan: 'Loan', account: 'Account' };
const leadLineDescription = (lead) => {
  const productName = lead.cardProduct?.name || lead.loanProduct?.name || lead.accountProduct?.name;
  const parts = [PRODUCT_TYPE_LABELS[lead.productType], lead.bank?.name, productName].filter(Boolean);
  return parts.length ? parts.join(' — ') : `Commission — Lead ${lead.leadNumber || lead._id}`;
};

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('lead'); // 'lead' | 'manual'
  const [form] = Form.useForm();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm] = Form.useForm();
  const [editing, setEditing] = useState(null); // invoice being edited, null when creating
  const [saving, setSaving] = useState(false);
  const [notesFor, setNotesFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/invoices');
      setInvoices(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/agencies').then((res) => setAgencies(res.data)).catch(() => {});
  }, []);

  const openSettings = async () => {
    try {
      const { data } = await api.get('/company-settings');
      settingsForm.setFieldsValue({
        accountName: data.bank?.accountName,
        bankName: data.bank?.bankName,
        accountNo: data.bank?.accountNo,
        iban: data.bank?.iban,
        notesLines: data.notesLines?.length ? data.notesLines : [''],
        vatNote: data.vatNote,
        vatRate: data.vatRate ?? 5,
        trn: data.trn || 'Under Process',
        contactName: data.contactName || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || 'admin@mysilah.ae',
      });
      setSettingsOpen(true);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load settings');
    }
  };

  const onSaveSettings = async () => {
    const values = await settingsForm.validateFields();
    try {
      await api.put('/company-settings', {
        bank: {
          accountName: values.accountName,
          bankName: values.bankName,
          accountNo: values.accountNo,
          iban: values.iban,
        },
        notesLines: values.notesLines,
        vatNote: values.vatNote,
        vatRate: values.vatRate,
        trn: values.trn,
        contactName: values.contactName || '',
        contactPhone: values.contactPhone || '',
        contactEmail: values.contactEmail,
      });
      message.success('Invoice settings updated — applies to every invoice going forward');
      setSettingsOpen(false);
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  // When editing, ?invoice=<id> also returns that invoice's own leads.
  const loadSuggestedLeads = async (agencyId, invoiceId) => {
    const params = { ...(agencyId && { agency: agencyId }), ...(invoiceId && { invoice: invoiceId }) };
    const { data } = await api.get('/invoices/suggest-leads', { params });
    setLeads(data);
  };

  const openCreate = async () => {
    form.resetFields();
    setEditing(null);
    setMode('lead');
    setLeads([]);
    form.setFieldsValue({
      lineItems: [{ customerName: '', description: '', qty: 1, unitPrice: undefined }],
      dueDays: 15,
      paymentTermsDays: 30,
      vatApplicable: false,
      vatRate: 5,
    });
    setOpen(true);
    try {
      const { data } = await api.get('/company-settings');
      form.setFieldsValue({ vatRate: data.vatRate ?? 5 });
    } catch {
      // keep the 5% fallback if settings can't be reached
    }
  };

  const openEdit = async (row) => {
    try {
      const { data } = await api.get(`/invoices/${row._id}`);
      const leadIds = data.leads?.length ? data.leads.map((l) => l._id) : (data.lead ? [data.lead._id] : []);
      form.resetFields();
      setEditing(data);
      setMode(leadIds.length ? 'lead' : 'manual');
      setLeads([]);
      form.setFieldsValue({
        agency: data.agency?._id,
        leadIds: leadIds.length ? leadIds : undefined,
        lineItems: data.lineItems.map((li) => ({
          customerName: li.customerName, leadNumber: li.leadNumber, description: li.description, qty: li.qty, unitPrice: li.unitPrice,
        })),
        vatApplicable: !!data.vatApplicable,
        vatRate: data.vatRate ?? 5,
        dueDays: data.dueDays ?? 15,
        paymentTermsDays: data.paymentTermsDays ?? 30,
        billToTrn: data.billTo?.trn,
        billToAddress: data.billTo?.address,
        billToContact: data.billTo?.contact,
        notes: data.notes,
      });
      setOpen(true);
      loadSuggestedLeads(data.agency?._id, data._id);
    } catch (err) {
      message.error(err.response?.data?.message || 'Could not load invoice');
    }
  };

  const onAgencyChange = (agencyId) => {
    form.setFieldsValue({ leadIds: undefined });
    if (mode === 'lead') loadSuggestedLeads(agencyId);
  };

  // Keeps what's already in the line items: lines of leads still selected
  // (with any edits) and typed-in manual lines stay, lines of leads that were
  // unselected go, and each newly selected lead gets a pre-filled line.
  const onLeadsChange = (leadIds) => {
    const selected = leadIds.map((id) => leads.find((l) => l._id === id)).filter(Boolean);
    const selectedNumbers = new Set(selected.map((l) => l.leadNumber));
    const current = form.getFieldValue('lineItems') || [];
    const kept = current.filter((li) => li && (li.leadNumber
      ? selectedNumbers.has(li.leadNumber)
      : (li.description || li.customerName || li.unitPrice != null)));
    const have = new Set(kept.map((li) => li.leadNumber).filter(Boolean));
    const added = selected.filter((l) => !have.has(l.leadNumber)).map((lead) => ({
      customerName: lead.customerName,
      leadNumber: lead.leadNumber,
      description: leadLineDescription(lead),
      qty: 1,
      unitPrice: lead.grossCommission || 0,
    }));
    const next = [...kept, ...added];
    form.setFieldsValue({ lineItems: next.length ? next : [{ customerName: '', description: '', qty: 1, unitPrice: undefined }] });
  };

  // Removing a lead's line also takes that lead off the invoice, so it goes
  // back to the pool when the invoice is saved.
  const removeLine = (remove, name) => {
    const leadNumber = form.getFieldValue(['lineItems', name, 'leadNumber']);
    remove(name);
    if (!leadNumber) return;
    const known = [...leads, ...(editing?.leads || []), ...(editing?.lead ? [editing.lead] : [])];
    const leadId = known.find((l) => l.leadNumber === leadNumber)?._id;
    const ids = (form.getFieldValue('leadIds') || []).filter((id) => id !== leadId);
    form.setFieldsValue({ leadIds: ids.length ? ids : undefined });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        agency: values.agency,
        leads: mode === 'lead' ? values.leadIds : (editing ? [] : undefined),
        lineItems: values.lineItems,
        notes: values.notes,
        dueDays: values.dueDays,
        paymentTermsDays: values.paymentTermsDays,
        billTo: { trn: values.billToTrn, address: values.billToAddress, contact: values.billToContact },
        vatApplicable: values.vatApplicable,
        vatRate: values.vatRate,
      };
      if (editing) {
        await api.put(`/invoices/${editing._id}`, payload);
        message.success(`Invoice ${editing.invoiceNumber} updated`);
      } else {
        await api.post('/invoices', payload);
        message.success('Invoice created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onNotesUpdated = (id, comments) => {
    setInvoices((prev) => prev.map((inv) => (inv._id === id ? { ...inv, comments } : inv)));
    setNotesFor((prev) => (prev && prev._id === id ? { ...prev, comments } : prev));
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/invoices/${id}/status`, { status });
      message.success(`Invoice marked ${status}`);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/invoices/${id}`);
      message.success('Invoice deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const confirmDelete = (row) => {
    Modal.confirm({
      title: `Delete invoice ${row.invoiceNumber}?`,
      icon: <ExclamationCircleFilled />,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => onDelete(row._id),
    });
  };

  const downloadPdf = async (row) => {
    try {
      const res = await api.get(`/invoices/${row._id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Download failed');
    }
  };

  const columns = [
    {
      title: 'Invoice #', dataIndex: 'invoiceNumber',
      render: (v, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{v}</span>
          {/* Purple dot = this invoice has notes; click to open them. */}
          {row.comments?.length > 0 && (
            <Tooltip title={`${row.comments.length} note${row.comments.length > 1 ? 's' : ''} — click to open`}>
              <span
                role="button"
                onClick={() => setNotesFor(row)}
                style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', cursor: 'pointer' }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
    { title: 'Agency', dataIndex: 'agency', render: (a) => a?.name || a?.email || '—' },
    {
      title: 'Lead',
      render: (_, row) => {
        if (row.leads?.length) return row.leads.map((l) => l.leadNumber || l._id).join(', ');
        if (row.lead) return row.lead.leadNumber;
        return <Typography.Text type="secondary">Manual</Typography.Text>;
      },
    },
    { title: 'Amount', dataIndex: 'amount', render: (v) => `AED ${Number(v || 0).toLocaleString()}` },
    {
      title: 'Status', dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Issued', dataIndex: 'issuedAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      width: 70,
      render: (_, row) => {
        const items = [
          { key: 'view', label: 'View', icon: <EyeOutlined /> },
          { key: 'pdf', label: 'Download PDF', icon: <DownloadOutlined /> },
          { key: 'edit', label: 'Edit', icon: <EditOutlined /> },
          { key: 'notes', label: `Notes${row.comments?.length ? ` (${row.comments.length})` : ''}`, icon: <MessageOutlined /> },
          ...(row.status === 'unpaid' ? [
            { type: 'divider' },
            { key: 'paid', label: 'Mark Paid', icon: <CheckOutlined /> },
            { key: 'cancel', label: 'Cancel', icon: <StopOutlined /> },
          ] : []),
          { type: 'divider' },
          { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true },
        ];
        const onMenuClick = ({ key }) => {
          if (key === 'view') window.open(`/invoices/${row._id}/view`, '_blank');
          else if (key === 'pdf') downloadPdf(row);
          else if (key === 'edit') openEdit(row);
          else if (key === 'notes') setNotesFor(row);
          else if (key === 'paid') setStatus(row._id, 'paid');
          else if (key === 'cancel') setStatus(row._id, 'cancelled');
          else if (key === 'delete') confirmDelete(row);
        };
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']}>
            <Button size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Invoices</h2>
        <Space>
          <Button icon={<SettingOutlined />} onClick={openSettings}>Bank &amp; Notes Settings</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create Invoice</Button>
        </Space>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={invoices} columns={columns} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title={editing ? `Edit Invoice ${editing.invoiceNumber}` : 'Create Invoice'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText={editing ? 'Save' : 'Create'} confirmLoading={saving} destroyOnClose width={640}>
        <Form form={form} layout="vertical">
          <Radio.Group
            value={mode}
            onChange={(e) => { setMode(e.target.value); form.setFieldsValue({ leadIds: undefined }); }}
            style={{ marginBottom: 16 }}
          >
            <Radio.Button value="lead">From a disbursed lead</Radio.Button>
            <Radio.Button value="manual">Manual</Radio.Button>
          </Radio.Group>

          <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Agency is required' }]}>
            <Select showSearch disabled={!!editing} options={agencyOptions} placeholder="Select agency" onChange={onAgencyChange} filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>

          {mode === 'lead' && (
            <Form.Item name="leadIds" label="Approved Leads" rules={[{ required: true, message: 'Select at least one lead' }]}>
              <Select
                mode="multiple"
                showSearch
                placeholder="Select one or more approved, not-yet-invoiced leads"
                onChange={onLeadsChange}
                options={leads.map((l) => {
                  const productName = l.cardProduct?.name || l.loanProduct?.name || l.accountProduct?.name || '';
                  return { value: l._id, label: `${l.leadNumber || l._id} — ${l.customerName}${productName ? ` · ${productName}` : ''} (AED ${Number(l.grossCommission || 0).toLocaleString()})` };
                })}
                filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                notFoundContent="No unbilled approved leads for this agency"
              />
            </Form.Item>
          )}

          <Form.List name="lineItems">
            {(fields, { add, remove }) => (
              <>
                <Typography.Text strong>Line Items {fields.length > 1 ? `(${fields.length})` : ''}</Typography.Text>
                {/* Scrolls independently so the modal (and its Save/Cancel footer)
                    stays usable no matter how many line items are added. */}
                <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, paddingRight: 4 }}>
                  {fields.map(({ key, name, ...rest }) => (
                    <Fragment key={key}>
                    {/* Lead number rides along with lead-based lines so the invoice can print it under the customer name. */}
                    <Form.Item {...rest} name={[name, 'leadNumber']} noStyle>
                      <Input type="hidden" />
                    </Form.Item>
                    <Space align="baseline" wrap style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...rest} name={[name, 'customerName']} style={{ width: 160, marginBottom: 0 }}>
                        <Input placeholder="Customer Name" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'description']} rules={[{ required: true, message: 'Description required' }]} style={{ width: 200, marginBottom: 0 }}>
                        <Input placeholder="Description" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'qty']} rules={[{ required: true, message: 'Qty required' }]} initialValue={1} style={{ width: 70, marginBottom: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={1} placeholder="Qty" />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'unitPrice']} rules={[{ required: true, message: 'Unit price required' }]} style={{ width: 140, marginBottom: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="Unit Price" />
                      </Form.Item>
                      {fields.length > 1 && <MinusCircleOutlined onClick={() => removeLine(remove, name)} />}
                    </Space>
                    </Fragment>
                  ))}
                </div>
                <Button type="dashed" onClick={() => add({ customerName: '', description: '', qty: 1, unitPrice: undefined })} style={{ marginTop: 8 }} block>
                  + Add Line Item
                </Button>
              </>
            )}
          </Form.List>

          <Space style={{ marginTop: 16 }} align="baseline">
            <Form.Item name="vatApplicable" label="Apply VAT" initialValue={false}>
              <Radio.Group optionType="button">
                <Radio.Button value={false}>No</Radio.Button>
                <Radio.Button value>Yes</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="vatRate" label="VAT Rate (%)" initialValue={5}>
              <InputNumber min={0} max={100} style={{ width: 100 }} />
            </Form.Item>
          </Space>

          <Space style={{ marginTop: 0 }}>
            <Form.Item name="dueDays" label="Due (days)" initialValue={15}>
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="paymentTermsDays" label="Payment Terms (days)" initialValue={30}>
              <InputNumber min={0} style={{ width: 160 }} />
            </Form.Item>
          </Space>

          <Typography.Text strong>Bill To Details (optional)</Typography.Text>
          <Space style={{ display: 'flex', marginTop: 8 }} wrap>
            <Form.Item name="billToTrn" style={{ width: 200, marginBottom: 8 }}>
              <Input placeholder="Agency TRN" />
            </Form.Item>
            <Form.Item name="billToAddress" style={{ width: 280, marginBottom: 8 }}>
              <Input placeholder="Agency Address" />
            </Form.Item>
            <Form.Item name="billToContact" style={{ width: 200, marginBottom: 8 }}>
              <Input placeholder="Contact / Email" />
            </Form.Item>
          </Space>

          <Form.Item name="notes" label="Notes" style={{ marginTop: 8 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <InvoiceNotesModal invoice={notesFor} open={!!notesFor} onClose={() => setNotesFor(null)} canWrite onUpdated={onNotesUpdated} />

      <Modal
        title="Bank & Notes Settings"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={onSaveSettings}
        okText="Save"
        destroyOnClose
        width={560}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
          Applies to every invoice — past and future — the next time it's viewed or downloaded.
        </Typography.Paragraph>
        <Form form={settingsForm} layout="vertical">
          <Form.Item name="trn" label="Company TRN" rules={[{ required: true, whitespace: true, message: 'Enter the TRN, or "Under Process"' }]} extra='Shown under Supplier on every invoice. Keep "Under Process" until the VAT TRN is issued.'>
            <Input />
          </Form.Item>

          <Typography.Text strong>Contact Person</Typography.Text>
          <Form.Item name="contactName" label="Name" style={{ marginTop: 8 }} extra="Leave empty to show the name of the admin who created the invoice.">
            <Input placeholder="e.g. MySilah" />
          </Form.Item>
          <Form.Item name="contactPhone" label="Phone" extra="Leave empty to show the phone of the admin who created the invoice (if any).">
            <Input placeholder="e.g. +971 50 123 4567" />
          </Form.Item>
          <Form.Item name="contactEmail" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Invalid email' }]}>
            <Input />
          </Form.Item>

          <Typography.Text strong>Bank Details</Typography.Text>
          <Form.Item name="accountName" label="Account Name" rules={[{ required: true }]} style={{ marginTop: 8 }}>
            <Input />
          </Form.Item>
          <Form.Item name="bankName" label="Bank Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="accountNo" label="Account No." rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="iban" label="IBAN" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Typography.Text strong>Notes &amp; Payment Terms</Typography.Text>
          <Form.List name="notesLines">
            {(fields, { add, remove }) => (
              <div style={{ marginTop: 8 }}>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...rest} name={name} rules={[{ required: true, message: 'Line cannot be empty' }]} style={{ width: 420, marginBottom: 0 }}>
                      <Input placeholder="Bullet line" />
                    </Form.Item>
                    {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(name)} />}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add('')} block>+ Add Line</Button>
              </div>
            )}
          </Form.List>

          <Form.Item name="vatNote" label="VAT / Registration Note" style={{ marginTop: 16 }}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="vatRate" label="Default VAT Rate (%)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: 120 }} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Used to prefill new invoices — each invoice still stores its own rate and VAT on/off, so changing this later won't alter invoices already created.
          </Typography.Text>
        </Form>
      </Modal>
    </>
  );
}

export default Invoices;
