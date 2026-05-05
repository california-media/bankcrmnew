import { useEffect, useState } from 'react';
import { Modal, Form, Select, Empty, Typography, message } from 'antd';
import api from '../api/client';

/**
 * Reusable modal that walks the user through:
 *   1) pick an agency (active list)
 *   2) pick one of that agency's banks
 *   3) POST /api/leads/:id/send-to-agency
 *
 * Used by both the agent's MyLeads and the admin's Leads page.
 */
function SendToAgencyModal({ open, onClose, lead, onSent }) {
  const [agencies, setAgencies] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [sending, setSending] = useState(false);
  const [form] = Form.useForm();
  const selectedAgency = Form.useWatch('agency', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setBanks([]);
    setLoadingAgencies(true);
    api.get('/agencies/active')
      .then((res) => setAgencies(res.data))
      .finally(() => setLoadingAgencies(false));
  }, [open, form]);

  useEffect(() => {
    if (!selectedAgency) { setBanks([]); return; }
    setLoadingBanks(true);
    api.get(`/banks/for-agency/${selectedAgency}`)
      .then((res) => {
        setBanks(res.data);
        const currentBank = form.getFieldValue('bank');
        if (currentBank && !res.data.some((b) => b._id === currentBank)) {
          form.setFieldValue('bank', undefined);
        }
      })
      .finally(() => setLoadingBanks(false));
  }, [selectedAgency, form]);

  const onOk = async () => {
    const values = await form.validateFields();
    if (!lead) return;
    setSending(true);
    try {
      await api.post(`/leads/${lead._id}/send-to-agency`, values);
      message.success('Lead sent to agency');
      onSent?.();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      title="Send Lead to Agency"
      open={open}
      onCancel={onClose}
      onOk={onOk}
      okText="Send"
      confirmLoading={sending}
      destroyOnClose
    >
      {lead && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Sending <b>{lead.customerName}</b> ({lead.productType === 'credit_card' ? 'Credit Card' : 'Loan'})
          {' '}to an agency. Bank options come from the chosen agency's bank list.
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical">
        <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Pick an agency' }]}>
          <Select
            loading={loadingAgencies}
            placeholder={loadingAgencies ? 'Loading…' : 'Pick an agency'}
            notFoundContent={<Empty description="No active agencies" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            options={agencies.map((a) => ({ value: a._id, label: a.name || a.email }))}
          />
        </Form.Item>
        <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Pick a bank' }]}>
          <Select
            loading={loadingBanks}
            disabled={!selectedAgency}
            placeholder={selectedAgency ? 'Pick a bank' : 'Select an agency first'}
            notFoundContent={
              selectedAgency
                ? <Empty description="This agency has no banks set up" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : null
            }
            options={banks.map((b) => ({ value: b._id, label: b.name }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default SendToAgencyModal;
