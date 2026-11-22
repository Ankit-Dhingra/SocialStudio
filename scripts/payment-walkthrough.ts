import type { TimedShot } from '../src/modules/video/visual-story.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type Node = Guide['nodes'][number];
type Cue = (phrase: string) => number;
const top = 670;
const middle = 940;
const bottom = 1180;
const left = 305;
const right = 765;
const center = 535;

export function paymentWalkthrough(scene: number, t: Cue): Guide {
  const node = (id: string, label: string, detail: string, icon: Node['icon'], x: number, y: number,
    at = 0, updates?: Node['updates']): Node => ({ id, label, detail, icon, x, y, at, updates });
  const change = (at: number, text: string, tone: 'blue' | 'gold' | 'green' = 'blue') => ({ at, text, tone });
  const edge = (from: string, to: string, at: number, label = '', tone: 'blue' | 'gold' | 'green' = 'blue') => ({ from, to, at, label, tone });
  switch (scene) {
    case 2:
      return { label: 'What the app does', title: 'The app starts the payment', nodes: [
        node('app', 'UPI app', 'Payment interface', 'phone', center, top),
        node('payer', 'Aman’s bank', 'Payer’s account', 'bank', left, middle, t('पैसे अपने पास')),
        node('merchant', 'Merchant’s bank', 'Recipient’s account', 'bank', right, middle, t('पैसे अपने पास')),
      ], notes: [{ at: t('अपने पास'), text: 'The app starts a request. The accounts are held by the banks.' }] };
    case 3:
      return { label: 'The payment network', title: 'UPI connects participating banks', nodes: [
        node('upi', 'UPI switch', 'Payment network', 'switch', center, top, t('UPI'), [
          change(t('NPCI'), 'Operated by NPCI'),
        ]),
        node('sbi', 'SBI', 'Payer bank', 'bank', left, middle, t('अलग-अलग बैंकों')),
        node('hdfc', 'HDFC', 'Merchant bank', 'bank', right, middle, t('अलग-अलग बैंकों')),
      ], edges: [
        edge('upi', 'sbi', t('connect करता')),
        edge('upi', 'hdfc', t('connect करता')),
      ] };
    case 4:
      return { label: 'Bank accounts', title: 'Account to account', nodes: [
        node('payer', 'Aman', 'SBI account', 'bank', left, middle),
        node('merchant', 'Chai seller', 'HDFC account', 'bank', right, middle),
      ], edges: [edge('payer', 'merchant', t('transfer'), 'via UPI')] };
    case 5:
      return { label: 'Start the payment', title: 'The scan identifies the merchant', nodes: [
        node('qr', 'Merchant QR', 'Read the payment address', 'qr', left, top, t('QR scan')),
        node('id', 'Merchant UPI ID', 'Recipient details', 'status', right, top, t('UPI ID')),
        node('amount', 'Aman’s app', 'Review and authorize', 'phone', center, middle, t('₹20 enter'), [
          change(t('₹20 enter'), '₹20', 'gold'), change(t('UPI PIN'), 'UPI PIN  ••••', 'green'),
        ]),
      ], edges: [edge('qr', 'id', t('UPI ID')), edge('id', 'amount', t('₹20 enter'))] };
    case 6:
      return { label: 'Route the request', title: 'App → PSP → UPI switch', nodes: [
        node('app', 'Aman’s app', 'Starts the request', 'phone', center, top),
        node('psp', 'PSP bank', 'Payment service provider', 'bank', center, middle, t('PSP bank')),
        node('upi', 'NPCI UPI switch', 'Receives the request', 'switch', center, bottom, t('NPCI')),
      ], edges: [
        edge('app', 'psp', t('PSP bank'), 'Payment request'),
        edge('psp', 'upi', t('UPI Switch'), 'Forward request'),
      ] };
    case 7:
      return { label: 'Address resolution', title: 'Find the recipient account', nodes: [
        node('upi', 'NPCI switch', 'Resolves the route', 'switch', center, top),
        node('merchant', 'Merchant UPI ID', 'Maps to the HDFC account', 'qr', right, middle, t('UPI ID'), [
          change(t('resolve'), 'Account resolved', 'green'),
        ]),
        node('sbi', 'SBI', 'Payer bank', 'bank', left, middle, t('SBI')),
      ], edges: [edge('upi', 'merchant', t('resolve')), edge('upi', 'sbi', t('debit request'), 'Debit request', 'gold')] };
    case 8:
      return { label: 'Debit and credit request', title: 'Aman’s account is debited', nodes: [
        node('upi', 'NPCI switch', 'Routes the bank requests', 'switch', center, top, t('इसके बाद')),
        node('sbi', 'SBI', 'Aman’s account', 'bank', left, middle, 0, [
          change(t('PIN verify'), 'Authorization check'),
          change(t('balance check'), 'Balance check'),
          change(t('₹20 debit'), '−₹20', 'gold'),
        ]),
        node('hdfc', 'HDFC', 'Merchant account', 'bank', right, middle, t('HDFC'), [
          change(t('credit request'), 'Credit requested'),
        ]),
      ], edges: [edge('upi', 'hdfc', t('credit request'), 'Credit request', 'gold')] };
    case 9:
      return { label: 'Credit and confirmation', title: 'Merchant receives ₹20', nodes: [
        node('hdfc', 'HDFC', 'Chai seller’s account', 'bank', left, top, 0, [
          change(t('₹20 credit'), '+₹20', 'green'),
        ]),
        node('upi', 'UPI network', 'Returns the result', 'switch', right, top, t('confirmation')),
        node('apps', 'Payment apps', 'Transaction status', 'phone', center, middle, t('payment apps'), [
          change(t('payment apps'), 'Success', 'green'),
        ]),
      ], edges: [
        edge('hdfc', 'upi', t('confirmation'), '', 'green'),
        edge('upi', 'apps', t('payment apps'), 'Success', 'green'),
      ], receiptAt: t('Soundbox') };
    case 10:
      return { label: 'Two clocks', title: 'Instant credit, later settlement', nodes: [
        node('seller', 'Merchant account', 'Customer payment', 'bank', center, top, 0, [
          change(t('तुरंत'), '₹20 appears now', 'green'),
        ]),
        node('banks', 'SBI ↔ HDFC', 'Between the banks', 'ledger', center, middle, t('SBI और HDFC'), [
          change(t('settlement बाद'), 'Interbank settlement later', 'gold'),
        ]),
      ], notes: [{ at: t('settlement बाद'), text: 'The credit and the interbank settlement are separate events.' }] };
    case 11:
      return { label: 'Interbank settlement', title: 'The banks settle net positions', nodes: [
        node('activity', 'UPI activity', 'Transactions across banks', 'ledger', center, top),
        node('npci', 'NPCI', 'Calculates net positions', 'switch', center, middle, t('net हिसाब')),
        node('rbi', 'RBI settlement', 'Member settlement accounts', 'bank', center, bottom, t('RBI')),
      ], edges: [
        edge('activity', 'npci', t('net हिसाब'), 'Net the obligations', 'gold'),
        edge('npci', 'rbi', t('settlement system'), 'Net settlement', 'gold'),
      ] };
    case 12:
      return { label: 'When confirmation is delayed', title: 'A debit can remain pending', nodes: [
        node('debit', 'Payer debited', 'Bank account entry', 'bank', left, top, t('debit')),
        node('confirm', 'Credit confirmation', 'Confirmation delayed', 'status', right, top, t('confirmation'), [
          change(t('pending'), 'Pending', 'gold'),
        ]),
        node('review', 'Status verification', 'Check the final outcome', 'status', left, middle, t('status verification')),
        node('reverse', 'Reversal', 'When applicable', 'ledger', right, middle, t('reversal')),
      ], edges: [edge('confirm', 'review', t('status verification')), edge('review', 'reverse', t('reversal'), '', 'gold')] };
    case 13:
      return { label: 'Follow the ₹20', title: 'Route, debit, credit', nodes: [
        node('route', 'Route', 'UPI routes the request', 'switch', left, top, t('route किया')),
        node('debit', 'Debit', 'SBI debits Aman', 'bank', right, top, t('पैसे debit')),
        node('credit', 'Credit', 'HDFC credits the seller', 'bank', left, middle, t('credit किया')),
        node('settle', 'Settle later', 'The banks settle their net position', 'ledger', right, middle, t('बाद में बैंकों')),
      ], edges: [
        edge('route', 'debit', t('पैसे debit')),
        edge('debit', 'credit', t('credit किया'), '', 'green'),
      ] };
    case 14:
      return { label: 'The distinction', title: 'Two separate events', nodes: [
        node('first', 'Instant credit', 'Merchant’s account', 'bank', left, middle, t('instant account credit'), [
          change(t('instant account credit'), 'Customer payment', 'green'),
        ]),
        node('next', 'Interbank settlement', 'Between participating banks', 'ledger', right, middle, t('interbank settlement'), [
          change(t('interbank settlement'), 'Net obligation', 'gold'),
        ]),
      ] };
    case 15:
      return { label: 'Follow for more', title: 'Behind The Tech', nodes: [
        node('story', 'Everyday tech', 'The systems behind it', 'switch', center, middle, t('engineering')),
      ] };
    default:
      throw new Error(`There is no directed teaching beat for scene ${scene + 1}.`);
  }
}
