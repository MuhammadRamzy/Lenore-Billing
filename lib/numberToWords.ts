const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertLessThanThousand(num: number): string {
  if (num === 0) return "";

  let words = "";

  if (num >= 100) {
    words += ONES[Math.floor(num / 100)] + " Hundred ";
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      words += ONES[num] + " ";
    } else {
      words += TENS[Math.floor(num / 10)] + " ";
      if (num % 10 > 0) {
        words += ONES[num % 10] + " ";
      }
    }
  }

  return words.trim();
}

export function numberToWords(amount: number): string {
  // Ensure the amount is rounded to two decimals
  const roundedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;
  const integerPart = Math.floor(roundedAmount);
  const decimalPart = Math.round((roundedAmount - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) {
    return "Zero Rupees Only";
  }

  let words = "";

  if (integerPart > 0) {
    let temp = integerPart;

    const crore = Math.floor(temp / 10000000);
    temp %= 10000000;

    const lakh = Math.floor(temp / 100000);
    temp %= 100000;

    const thousand = Math.floor(temp / 1000);
    temp %= 1000;

    const hundred = temp;

    if (crore > 0) {
      words += numberToWordsHelper(crore) + " Crore ";
    }

    if (lakh > 0) {
      words += numberToWordsHelper(lakh) + " Lakh ";
    }

    if (thousand > 0) {
      words += numberToWordsHelper(thousand) + " Thousand ";
    }

    if (hundred > 0) {
      words += convertLessThanThousand(hundred) + " ";
    }

    words = "Rupees " + words.trim();
  }

  if (decimalPart > 0) {
    const decimalWords = convertLessThanThousand(decimalPart);
    if (integerPart > 0) {
      words += " and " + decimalWords + " Paisa";
    } else {
      words = decimalWords + " Paisa";
    }
  }

  return (words.trim() + " Only").replace(/\s+/g, " ");
}

function numberToWordsHelper(num: number): string {
  if (num === 0) return "";
  
  let words = "";
  
  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const hundred = num;

  if (crore > 0) {
    words += numberToWordsHelper(crore) + " Crore ";
  }

  if (lakh > 0) {
    words += convertLessThanThousand(lakh) + " Lakh ";
  }

  if (thousand > 0) {
    words += convertLessThanThousand(thousand) + " Thousand ";
  }

  if (hundred > 0) {
    words += convertLessThanThousand(hundred) + " ";
  }

  return words.trim();
}
