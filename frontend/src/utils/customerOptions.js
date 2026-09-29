// Customer-detail option lists shared by the lead submit form and the
// lead detail page's "Edit Customer Details" form.
export const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Antiguan',
  'Argentine', 'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian',
  'Bahraini', 'Bangladeshi', 'Barbadian', 'Belarusian', 'Belgian', 'Belizean',
  'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian', 'Botswanan', 'Brazilian',
  'British', 'Bruneian', 'Bulgarian', 'Burkinabe', 'Burundian', 'Cambodian',
  'Cameroonian', 'Canadian', 'Cape Verdean', 'Central African', 'Chadian',
  'Chilean', 'Chinese', 'Colombian', 'Comorian', 'Congolese', 'Costa Rican',
  'Croatian', 'Cuban', 'Cypriot', 'Czech', 'Danish', 'Djiboutian', 'Dominican',
  'Dutch', 'East Timorese', 'Ecuadorian', 'Egyptian', 'Emirati', 'Equatorial Guinean',
  'Eritrean', 'Estonian', 'Eswatini', 'Ethiopian', 'Fijian', 'Finnish', 'French',
  'Gabonese', 'Gambian', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Grenadian',
  'Guatemalan', 'Guinean', 'Guinea-Bissauan', 'Guyanese', 'Haitian', 'Honduran',
  'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish',
  'Israeli', 'Italian', 'Ivorian', 'Jamaican', 'Japanese', 'Jordanian',
  'Kazakhstani', 'Kenyan', 'Kiribati', 'Korean', 'Kuwaiti', 'Kyrgyzstani',
  'Laotian', 'Latvian', 'Lebanese', 'Lesotho', 'Liberian', 'Libyan',
  'Liechtenstein', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy',
  'Malawian', 'Malaysian', 'Maldivian', 'Malian', 'Maltese', 'Marshallese',
  'Mauritanian', 'Mauritian', 'Mexican', 'Micronesian', 'Moldovan', 'Monacan',
  'Mongolian', 'Montenegrin', 'Moroccan', 'Mozambican', 'Myanmar', 'Namibian',
  'Nauruan', 'Nepali', 'New Zealander', 'Nicaraguan', 'Nigerian', 'Nigerien',
  'Norwegian', 'Omani', 'Pakistani', 'Palauan', 'Palestinian', 'Panamanian',
  'Papua New Guinean', 'Paraguayan', 'Peruvian', 'Philippine', 'Polish',
  'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Salvadoran',
  'Samoan', 'Saudi Arabian', 'Senegalese', 'Serbian', 'Seychellois',
  'Sierra Leonean', 'Singaporean', 'Slovak', 'Slovenian', 'Solomon Islander',
  'Somali', 'South African', 'South Sudanese', 'Spanish', 'Sri Lankan',
  'Sudanese', 'Surinamese', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese',
  'Tajikistani', 'Tanzanian', 'Thai', 'Togolese', 'Tongan', 'Trinidadian',
  'Tunisian', 'Turkish', 'Turkmenistani', 'Tuvaluan', 'Ugandan', 'Ukrainian',
  'Uruguayan', 'Uzbekistani', 'Vanuatuan', 'Venezuelan', 'Vietnamese', 'Yemeni',
  'Zambian', 'Zimbabwean',
].map((n) => ({ value: n, label: n }));

export const CITIES = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah',
  'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Other',
].map((c) => ({ value: c, label: c }));

export const VISA_OPTIONS = [
  { value: 'employment', label: 'Employment Visa' },
  { value: 'residence',  label: 'Residence Visa' },
  { value: 'investor',   label: 'Investor Visa' },
  { value: 'golden',     label: 'Golden Visa' },
  { value: 'freelance',  label: 'Freelance Visa' },
  { value: 'tourist',    label: 'Tourist Visa' },
  { value: 'other',      label: 'Other' },
];
