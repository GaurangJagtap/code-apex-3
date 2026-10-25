import { BugFinding } from '../api/client';

export interface SimpleBugExplanation {
  headline: string;
  inSimpleWords: string;
  whatWasExpected: string;
  whatActuallyHappened: string;
  whyItMatters: string;
  tags: string[];
}

/**
 * Converts technical defect findings, assertion violations, or status codes
 * into clear, friendly, everyday English so that anyone (judges, product managers, non-technical users)
 * can understand what went wrong within 5 seconds.
 */
export function getSimpleBugExplanation(bug: BugFinding): SimpleBugExplanation {
  const title = (bug.title || '').toLowerCase();
  const desc = (bug.description || '').toLowerCase();
  const expected = (bug.expected_behavior || '').toLowerCase();
  const actual = (bug.actual_behavior || '').toLowerCase();
  const url = (bug.affected_url || '').toLowerCase();
  const combined = `${title} ${desc} ${expected} ${actual} ${url}`;

  // 1. Cart Quantity & Subtotal Calculation Desync
  if (combined.includes('subtotal') || combined.includes('quantity') || combined.includes('cart') && (combined.includes('arithmetic') || combined.includes('recalculate') || combined.includes('desync'))) {
    return {
      headline: "Shopping Cart Bill Didn't Update When Quantity Changed",
      inSimpleWords: "When more items were added or quantity was increased in the cart, the total bill stayed frozen at the old price instead of recalculating.",
      whatWasExpected: "Whenever you increase the quantity of an item, the website should immediately multiply (Price × Quantity) and update the total bill.",
      whatActuallyHappened: "The cart display showed 2 or more items, but the subtotal money charged remained stuck at the single-item price.",
      whyItMatters: "Customers will see contradictory numbers, get confused at checkout, or be billed the wrong amount.",
      tags: ["Money Calculation", "Cart Desync", "High Impact"]
    };
  }

  // 2. Email Validation Missing / Bypass
  if (combined.includes('email') || (combined.includes('register') && combined.includes('validation'))) {
    return {
      headline: "Sign-Up Form Accepted a Broken Email Address",
      inSimpleWords: "The registration form let someone register using an invalid email that didn't have an '@' sign or website domain name.",
      whatWasExpected: "The form should stop the user and show a red error: 'Please enter a valid email address with @ and domain'.",
      whatActuallyHappened: "The form naively accepted incomplete text (like 'invalid_user') and created the account anyway.",
      whyItMatters: "The user will never receive confirmation emails, purchase receipts, or password reset links, resulting in locked-out accounts.",
      tags: ["Form Validation", "Account Safety"]
    };
  }

  // 3. Postal Code / ZIP Code Validation Missing
  if (combined.includes('postal') || combined.includes('zip') || combined.includes('address')) {
    return {
      headline: "Delivery Form Allowed an Empty Postal/ZIP Code",
      inSimpleWords: "The delivery address form let the order proceed even though the required postal or ZIP code was left completely blank.",
      whatWasExpected: "The website must require a valid 5 or 6 digit postal code before allowing the customer to continue to payment.",
      whatActuallyHappened: "The empty postal code passed validation with no warning, and the order moved directly to payment.",
      whyItMatters: "Couriers and delivery riders cannot find the neighborhood or dispatch the package without a postal code.",
      tags: ["Delivery Logistics", "Required Field"]
    };
  }

  // 4. Duplicate Order on Rapid Double-Click / Non-Idempotent Submit
  if (combined.includes('duplicate') || combined.includes('double') || combined.includes('idempotent') || combined.includes('rapid submit')) {
    return {
      headline: "Clicking 'Pay' Twice Placed Two Duplicate Orders",
      inSimpleWords: "When the user rapidly tapped the submit or order button twice, the system created two identical orders instead of ignoring the second click.",
      whatWasExpected: "The button should disable immediately upon first click and ignore any rapid second clicks.",
      whatActuallyHappened: "Two separate orders with two different order numbers were created in the database, charging twice.",
      whyItMatters: "Customers get charged twice for the exact same order and demand refunds or customer support.",
      tags: ["Duplicate Charge", "Double-Click Flaw"]
    };
  }

  // 5. Payment Declined But Falsely Confirmed as Success
  if (combined.includes('decline') || combined.includes('simulator') && combined.includes('payment') || combined.includes('falsely confirmed')) {
    return {
      headline: "Declined Card Was Mistakenly Shown as 'Order Successful'",
      inSimpleWords: "The bank rejected the simulated payment card, but the website showed a green 'Order Confirmed' screen anyway.",
      whatWasExpected: "A declined transaction must halt checkout, keep the cart intact, and ask the user to provide a working payment method.",
      whatActuallyHappened: "The website celebrated a successful order and generated a confirmation number even though $0 was paid.",
      whyItMatters: "The business would dispatch food or goods without ever collecting payment.",
      tags: ["Payment Integrity", "Critical Flaw"]
    };
  }

  // 6. Order Status Discrepancy (UI Confirmed vs Backend Cancelled)
  if (combined.includes('confirmation') && combined.includes('status') || combined.includes('discrepancy') || combined.includes('cancelled')) {
    return {
      headline: "Screen Claimed 'Confirmed' While the System Marked it 'Cancelled'",
      inSimpleWords: "The webpage told the customer their order was placed successfully, but the internal system database marked the order as cancelled.",
      whatWasExpected: "The confirmation screen must honestly reflect the true, authoritative order status saved in the database.",
      whatActuallyHappened: "The user is shown a happy confirmation screen, but the kitchen/warehouse never receives an active order.",
      whyItMatters: "The customer sits and waits for a delivery that will never arrive.",
      tags: ["Data Integrity", "False Status"]
    };
  }

  // 7. Assessment Answers Reset / Lost on Page Reload
  if (combined.includes('reload') || combined.includes('refresh') && (combined.includes('answer') || combined.includes('exam') || combined.includes('assess'))) {
    return {
      headline: "Test Answers Were Erased When the Page Refreshed",
      inSimpleWords: "When the candidate refreshed the exam page or moved between questions, all their selected answers were completely wiped out.",
      whatWasExpected: "A candidate's answers should stay securely saved in memory/storage so refreshing the browser doesn't lose their work.",
      whatActuallyHappened: "All radio buttons and question inputs reset back to empty unanswered states.",
      whyItMatters: "Candidates will lose all their hard work during a timed exam if their WiFi blips or browser refreshes.",
      tags: ["Exam Progress", "Data Loss"]
    };
  }

  // 8. Assessment Score Calculation Wrong Against Answer Key
  if (combined.includes('score') || combined.includes('answer key') || combined.includes('arithmetic desync')) {
    return {
      headline: "Candidate Score Was Calculated Lower Than Actually Earned",
      inSimpleWords: "The candidate answered questions correctly, but the scoring calculator had a bug that miscounted their total points.",
      whatWasExpected: "The system must match candidate answers against the answer key and award 100% of the earned points.",
      whatActuallyHappened: "The final score was underreported (giving fewer points than the candidate legitimately earned).",
      whyItMatters: "Qualified applicants could be unfairly rejected by automated recruitment filters.",
      tags: ["Scoring Logic", "Hiring Impact"]
    };
  }

  // 9. Unauthorized Access / Recruiter Dashboard Exposed to Public
  if (combined.includes('access control') || combined.includes('unauthenticated') || combined.includes('anonymous') || combined.includes('recruiter') || combined.includes('/account')) {
    return {
      headline: "Private Profile & Evaluation Dashboard Left Open to the Public",
      inSimpleWords: "Anyone who types the web address can see confidential candidate scores or personal account details without entering a password.",
      whatWasExpected: "Private dashboards and customer accounts must redirect unauthenticated visitors to a secure login page.",
      whatActuallyHappened: "The webpage openly served confidential profiles and assessment records to anonymous visitors.",
      whyItMatters: "Major security and data privacy breach exposing confidential applicant or customer data.",
      tags: ["Security Flaw", "Privacy Leak"]
    };
  }

  // 10. Access Code / Passkey Check Bypassed
  if (combined.includes('access code') || combined.includes('invitation') || combined.includes('passkey')) {
    return {
      headline: "Private Exam Allowed Entry Without a Valid Invitation Code",
      inSimpleWords: "Candidates were able to bypass the invitation gate and enter the private assessment with a blank or invalid access code.",
      whatWasExpected: "The assessment gate must reject blank or malformed passkeys and require a valid 6-character code.",
      whatActuallyHappened: "The gate let the user proceed straight into the private examination.",
      whyItMatters: "Anyone on the internet could take private hiring assessments without being invited.",
      tags: ["Security Gate", "Access Control"]
    };
  }

  // Generic Intelligent Fallback
  return {
    headline: bug.title || "Unexpected Behavior in User Workflow",
    inSimpleWords: `The automated tester took action on this page and discovered that the website behaved incorrectly: ${bug.actual_behavior || 'an unexpected state was observed'}.`,
    whatWasExpected: bug.expected_behavior || "The website was expected to complete the action cleanly and update state.",
    whatActuallyHappened: bug.actual_behavior || "The application failed an invariant check or encountered an error.",
    whyItMatters: "Users navigating this workflow will encounter unexpected roadblocks, errors, or inconsistent state.",
    tags: [bug.category?.split(' ')[0] || "Functional", bug.severity]
  };
}
