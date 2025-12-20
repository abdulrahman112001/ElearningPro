// RTL Utility Classes Helper
// This file helps with RTL-aware spacing and positioning

export const rtlClasses = {
  // Margin classes
  ms: {
    0: "ms-0",
    1: "ms-1",
    2: "ms-2",
    3: "ms-3",
    4: "ms-4",
    6: "ms-6",
    8: "ms-8",
    auto: "ms-auto",
  },
  me: {
    0: "me-0",
    1: "me-1",
    2: "me-2",
    3: "me-3",
    4: "me-4",
    6: "me-6",
    8: "me-8",
    auto: "me-auto",
  },
  // Padding classes
  ps: {
    0: "ps-0",
    1: "ps-1",
    2: "ps-2",
    3: "ps-3",
    4: "ps-4",
    6: "ps-6",
    8: "ps-8",
    10: "ps-10",
  },
  pe: {
    0: "pe-0",
    1: "pe-1",
    2: "pe-2",
    3: "pe-3",
    4: "pe-4",
    6: "pe-6",
    8: "pe-8",
    10: "pe-10",
  },
  // Position classes
  start: {
    0: "start-0",
    3: "start-3",
    4: "start-4",
  },
  end: {
    0: "end-0",
    3: "end-3",
    4: "end-4",
  },
  // Text alignment
  text: {
    start: "text-start",
    end: "text-end",
  },
  // Border radius
  rounded: {
    sLg: "rounded-s-lg",
    eLg: "rounded-e-lg",
  },
}

// Helper function to generate RTL-aware class strings
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ")
}
