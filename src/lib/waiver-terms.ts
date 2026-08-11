// My Fit Pod's actual Terms & Conditions (incl. House Rules, Access Details
// Policy, and the Waiver clause) — the client's own business document,
// provided directly for this exact purpose, reproduced in full since a
// legal waiver can't be summarised or truncated without misrepresenting
// what a member is agreeing to.

export type WaiverBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: { title: string; body: string }[] };

export const WAIVER_TERMS: WaiverBlock[] = [
  { type: "heading", text: "Terms and Conditions" },
  {
    type: "paragraph",
    text: "By completing any transaction with My Fit Pod or using a My Fit Pod service in any format, you are agreeing to abide by the Terms & Conditions. In addition to this, you are also agreeing to our other policies that reside in the Terms & Condition but also form their own entity.",
  },
  { type: "paragraph", text: "House Rules — Cancellation Policy — Privacy Policy" },
  {
    type: "paragraph",
    text: 'These Terms & Conditions ("Terms") constitute a legally binding agreement between you and My Fit Pod Ltd ("My Fit Pod", "we", "us" or "our"). These Terms govern your access to the use of any My Fit Pod gyms, the ("Network"), the My Fit Pod Website and any other websites through which My Fit Pod makes the Network available, the ("Website") and our Mobile Application, other smart device applications and application program interfaces, the ("APIs") through which My Fit Pod makes the Network available, the ("Mobile Application"). The Website, the Mobile Application and Network are collectively referred to as ("My Fit Pod").',
  },

  { type: "subheading", text: "1. GENERAL" },
  {
    type: "paragraph",
    text: "My Fit Pod Ltd is a company registered in England and Wales. Our company registration number is 13168737. Our registered VAT number is 336466191.",
  },
  {
    type: "paragraph",
    text: "If you have any questions or if you have any complaints after reading these Terms, please contact us. You can contact us on hello@myfitpod.co.uk",
  },
  {
    type: "paragraph",
    text: "If we take no action on any breach of this agreement or give you extra time to pay or comply, it will not stop us enforcing the Terms again strictly at a future date.",
  },
  {
    type: "paragraph",
    text: "We may assign the benefit of these Terms and our rights thereunder to a third-party on notice to you. Your rights under these Terms will not be prejudiced.",
  },
  {
    type: "paragraph",
    text: "We will not be liable or responsible for any failure to perform, or delay in performance of, any of our obligations under these Terms that is caused by any event that is outside of our reasonable control.",
  },
  {
    type: "paragraph",
    text: "We will not be liable or responsible for outstanding money paid to a Personal Trainer. My Fit Pod does not arrange or interfere with the relationship between the Personal Trainer and Client.",
  },
  {
    type: "paragraph",
    text: "As a consumer, you have legal rights in relation to any services that are not carried out with reasonable skill and care, or if the materials we use are faulty or not as described. Advice about your legal rights is available from your local Citizens' Advice Bureau or Trading Standards office. Nothing in these Terms will affect these legal rights.",
  },
  {
    type: "paragraph",
    text: "We may terminate this agreement with immediate effect on notifying you if you are in breach of this or any other of the policies that reside below.",
  },
  {
    type: "paragraph",
    text: "My Fit Pod reserves the right to change or modify any of these Terms without notice and in its sole discretion. Any changes or modifications to these Terms will be effective upon posting of the changes. Your continued use of My Fit Pod following the posting of any changes or modifications constitutes your acceptance of such changes or modifications and if you do not agree with these changes or modifications, you must immediately cease using My Fit Pod. You are responsible for regularly reviewing the most current Terms as well as all other policies that reside in the below.",
  },

  { type: "subheading", text: "2. ELIGIBILITY AND USE OF MY FIT POD" },
  {
    type: "paragraph",
    text: "You must be 18 years old or over and able to enter legally binding contracts to access and use My Fit Pod or register for a My Fit Pod Account. My Fit Pod (which constitutes the Website, Mobile Application and Network) are not available to persons under the age of 18. By using the Website, Mobile Application or Network, you represent and warrant that you are 18 years old or over and have the legal capacity and authority to enter a contract. Furthermore, you will not allow the access of anybody under 18 years old into My Fit Pod without prior approval from My Fit Pod. Please email hello@myfitpod.co.uk for approval.",
  },
  {
    type: "paragraph",
    text: "Your participation in using My Fit Pod is for your sole, personal use and not for commercial purposes. You may not authorise others to use your username and/or password in any entity. When using My Fit Pod, you agree to comply with all applicable laws of the country, state, province or city in which you are present whilst using My Fit Pod.",
  },
  {
    type: "paragraph",
    text: "As described in the Privacy Policy which can be found in the headline of these Terms, My Fit Pod uses a third-party payment processor Stripe to link your credit card Account to the Website and the Mobile Application. The processing of your payments or Packages for the Website, Mobile Application or Network will be subject to the Terms & Conditions and Privacy Policy of Stripe along with the issuing bank in addition to these Terms. My Fit Pod is not responsible for any errors made by Stripe or your issuing bank.",
  },
  {
    type: "paragraph",
    text: 'By using My Fit Pod, you agree to be bound by and comply with any additional Term & Conditions and other residing policies provided by the Landlord and/or the Managing Agent ("Property Managers") of the Network including compliance with building security procedures, IT access and procedures provided by the Property Managers which may be provided in electronic format through the Website, Mobile Application or in hardcopy in the Network.',
  },
  {
    type: "paragraph",
    text: "Some components of My Fit Pod implement APIs such as Google Maps. Your use of Google Maps is subject to the Google Maps Terms & Conditions and if you visit the Website or download the Mobile Application from the Apple App Store, you are also agreeing to Apple's Terms & Conditions. You can find both sets of Terms & Conditions of each respective Website.",
  },

  { type: "subheading", text: "3. PERSONAL TRAINER SPECIFIC TERMS" },
  {
    type: "paragraph",
    text: "If you are a personal trainer using My Fit Pod, you must have a valid Professional Liability Insurance Policy with a minimum general liability coverage of £2,000,000 in order to sign up for a personal trainer Account via emailing hello@myfitpod.co.uk. This insurance policy must be in force at the time to register for an Account and must be kept in force during your use of My Fit Pod. We reserve the right to request a copy of an insurance policy and any other information we may require.",
  },
  {
    type: "paragraph",
    text: "My Fit Pod cannot be held responsible for personal trainers or their clients in relation to, but not limited to, injury, illness or lost of income due to the use of our services. Personal Trainers are also required to check equipment prior to starting a session and advise My Fit Pod if they see any defects or experience issues whilst using.",
  },

  { type: "subheading", text: "4. ACCOUNT REGISTRATION" },
  {
    type: "paragraph",
    text: "To be able to use the Mobile Application or the Network you need to sign up for an Account with My Fit Pod which you can do through the Mobile Application. When signing up, you will be asked to provide My Fit Pod with your personal information and credit card information which will be held and processed by our third-party payment processor, Stripe, as set out above and in our Privacy Policy.",
  },
  {
    type: "paragraph",
    text: 'Once you complete your sign-up with My Fit Pod, you will be provided with a personal account ("Account"). You agree to complete and maintain accurate and up-to-date information in your Account. Your failure to complete and maintain accurate and up-to-date Account information, including having an invalid or expired credit card on file, may result in your inability to access and use the Website, Mobile Application or Network. My Fit Pod reserves the right to suspend or terminate your Account and refuse all current or future uses of My Fit Pod if My Fit Pod has reasonable grounds to suspect that such information is inaccurate, outdated or untrue. You may not use My Fit Pod for any illegal purpose or in any manner inconsistent with these Terms.',
  },
  {
    type: "paragraph",
    text: "You are responsible for all activity that occurs with respect to your Account including, but not limited to, use of the Website, Mobile Application and Network. Without limiting the foregoing, for any reservation made through the Account, if other persons are present in the Network, you hereby agree to be fully responsible and to indemnify My Fit Pod for any violation of these Terms or applicable laws, by-laws or regulations, even if such violation was caused by such other persons.",
  },

  { type: "subheading", text: "5. HOUSE RULES" },
  {
    type: "paragraph",
    text: "Please read the below carefully. By completing any transaction with My Fit Pod or using a My Fit Pod service in any format, you are agreeing to abide by the House Rules. We ask you to make sure you are happy that you can comply with the House Rules before continuing. My Fit Pod has the right to use its sole discretion to add or alter at any time to prevent a breach of our Terms & Conditions.",
  },
  { type: "subheading", text: "YOU WILL" },
  {
    type: "list",
    items: [
      { title: "1. Please invite guests via our app", body: "You will invite any guests via the My Fit Pod Mobile Application only so we can account for the number of users in our facility at any one time." },
      { title: "2. Please wear suitable clothing", body: "You will wear suitable gym clothing and footwear whilst using any My Fit Pod facility." },
      { title: "3. Please sanitise your hands before use", body: "You will sanitise your hands before using My Fit Pod equipment with the sanitiser station provided." },
      { title: "4. Please store any bags away from the gym floor", body: "You will safely store any bags and personal belongings away from the gym floor and inside the storage space or bathroom areas." },
      { title: "5. Please leave My Fit Pod as you find it", body: "You will leave My Fit Pod in a clean and tidy condition. This includes but not limited to, putting away equipment neatly, removing any trip hazards, removing any litter, wiping down machines and equipment, clearing any spillages and sanitising your hands." },
      { title: "6. Please take all belongings", body: "You will take all your belongings with you when leaving My Fit Pod. Neither My Fit Pod, the Landlord and/or the Managing Agent is responsible for any property left behind." },
      { title: "7. Please leave on time", body: "You will exit My Fit Pod on time and be courteous to any users entering after you." },
      { title: "8. Damages to My Fit Pod will be charged", body: "You will be responsible and charged for the damage to equipment outside of normal wear and tear or necessary cleaning of a My Fit Pod due to your violation of this agreement or any agreement as outlined in the Terms & Conditions." },
      { title: "9. Theft of equipment will be charged", body: "You will be held liable and charged for any costs incurred to replace equipment taken from the My Fit Pod." },
      { title: "10. Please bring ID", body: "You will provide proof of identity if reasonably requested by My Fit Pod, the Landlord and/or Managing Agent." },
      { title: "11. Please follow any additional rules", body: "" },
    ],
  },
  { type: "subheading", text: "YOU WILL NOT" },
  {
    type: "list",
    items: [
      { title: "1. Please don't exceed 5 people in My Fit Pod", body: "You will not allow access of more than 5 people, inclusive of yourself, to enter the My Fit Pod." },
      { title: "2. Please don't share your access details", body: "You will not share your access details / Access Device." },
      { title: "3. Please don't allow access to strangers", body: "You will not provide My Fit Pod access to anybody you do not know or have not formally invited using the Mobile Application." },
      { title: "4. Please don't miss-use My Fit Pod software", body: "You will not use the Website, Mobile Application or Network for sending or storing any unlawful material." },
      { title: "5. Please don't miss-use the facility", body: "You will not use My Fit Pod for unlawful or illegal purposes." },
      { title: "6. Please don't use My Fit Pod inappropriately", body: "You will not use the My Fit Pod Website, Mobile Application or Network for any inappropriate purposes, including but not limited to drugs, alcohol, gambling, sexual activity, extreme sports or any other purpose likely to reflect negatively on My Fit Pod, the Landlord and/or the Managing Agent." },
      { title: "7. No smoking in My Fit Pod", body: "You will not smoke inside any My Fit Pod (this includes e-cigarettes)." },
      { title: "8. Do not bring harmful objects into My Fit Pod", body: "You will not bring any harmful weapons or sharp objectives into the My Fit Pod including but not limited to firearms and knives." },
      { title: "9. No naked flames in My Fit Pod", body: "You will not allow any naked flame inside My Fit Pod through lighters, candles or other." },
      { title: "10. Please don't make excessive noise", body: "You will not make excessive noise or create noise that My Fit Pod, the Landlord and/or Managing Agent deems to be a disturbance to surrounding retail, office or residential dwellings." },
      { title: "11. Do not bring animals to the facility", body: "You will not bring any animals into My Fit Pod, except for service animals which should always be harnessed and leashed." },
      { title: "12. No under 18 in the facility", body: "You will not allow the access of anybody under 18 years old into My Fit Pod without prior approval from My Fit Pod. Please email hello@myfitpod.co.uk for approval." },
      { title: "13. Please don't tamper with equipment", body: "You will not install, remove or modify any My Fit Pod fixtures, fittings, equipment, hardware or appliances." },
      { title: "14. Do not miss use technology", body: "You will not use the WiFi or Bluetooth services of My Fit Pod for unlawful purposes or anti-social behaviour." },
      { title: "15. Please support the My Fit Pod brand", body: "You will not tarnish or purposely sabotage the My Fit Pod brand or intellectual property through the Website, Mobile Application or Network." },
    ],
  },

  { type: "subheading", text: "ACCESS DETAILS POLICY" },
  {
    type: "paragraph",
    text: "Your Access details / Access Device can only be used by you and your Access details / Access Device is issued solely for your use, as your account is personal to you and only covers your use of My Fit Pod. You are responsible for keeping your Access details / Access Device secure and confidential at all times. The Access details / Access Device remains our property at all times (unless agreed otherwise and evidenced in writing).",
  },
  {
    type: "paragraph",
    text: "Use of Access details are monitored in the interests of the safety and security of all our users, use of any Access details and access is monitored and individuals using Access details / Access Devices may be asked to provide proof of identification.",
  },
  {
    type: "paragraph",
    text: "Should we believe that your Access details / Access Device has been used by another individual or individuals we may (in our discretion) decide to conduct an investigation. If we do so we will: (a) inform you, via email, that we believe your Access details / Access Device has been used by another individual or individuals and ask you to provide us with reasonable assistance to investigate the matter; and (b) following our investigation we will contact you, via email, to inform you of our findings and our proposed course of action, which may include one or more of the steps set out in the below.",
  },
  {
    type: "paragraph",
    text: "If you unreasonably refuse to cooperate with our investigation, or following our investigation we have reasonable grounds to believe that your Access details / Access Device was used, with or without your knowledge and/or consent, by another individual or individuals, depending on the particular circumstances of each case, we reserve the right to take one or both of the following steps, which are in addition to any other legal rights that we may have: (a) to apply a penalty charge to your card on file. The penalty charge will be calculated as being equal to the daily charge (that applied at the time of use) for each occasion on which your Access details were used by that individual/those individuals; and/or (b) in the event of serious misuse of your Access details, for example, your Access details have been used on repeated occasions and/or by more than one individual, to notify you, via email, that we are cancelling your Account with immediate effect, and no refunds will be given.",
  },
  {
    type: "paragraph",
    text: "If we have reasonable grounds for believing that you knowingly provided your Access details / Access Device to another individual or individuals, or allowed unauthorised entry following your entry to My Fit Pod (known as tailgating) in addition to our rights referred to above, we may hold you responsible for the conduct of the individual(s) while on our premises, and liable for any loss we suffer as a consequence of that conduct.",
  },
  {
    type: "paragraph",
    text: '("Access Device") is the device, member card, or any other relevant security hardware device with built-in authentication equipment, issued or otherwise provided to you by us to enable you to securely access the relevant My Fit Pod in accordance with the Terms of your Account. Only one device can be registered to an Account at any time, if you lose or misplace the device you need to contact hello@myfitpod.co.uk to remove the device immediately.',
  },

  { type: "subheading", text: "6. DAMAGES, REPAIR AND/OR CLEANING FEES" },
  {
    type: "paragraph",
    text: 'As a user of My Fit Pod, you are responsible for leaving the Network, any property and surrounding area in the same or better condition than when you arrived. You are responsible for your actions and omissions and are also responsible for the acts and omissions of any individuals whom you invite and/or provide access to. Further to this, you are responsible for the cost of any damage repairs or necessary cleaning of the Network resulting from your violation of this agreement or your use of the Network in excess of normal "wear and tear". If My Fit Pod, in its reasonable discretion, determines that excessive repair or cleaning is required, My Fit Pod reserves the right to charge the payment method designated in your Account for the reasonable cost of such repair and/or cleaning as well as an additional service fee which shall not exceed £500 per occurrence. Any such amounts are non-refundable and at the reasonable discretion of My Fit Pod.',
  },

  { type: "subheading", text: "7. PAYMENT TERMS" },
  {
    type: "paragraph",
    text: "Any fees which My Fit Pod may charge you for the use of the Website, Mobile Application or Network will be as set out in the Website and/or Mobile application at the time of the purchase. These fees are inclusive of any taxes payable e.g. VAT. My Fit Pod offers a no Refund Policy, instead we work in line with our Cancellation Policy which can be found in the headline of these Terms and below Clause 9. This no Refund Policy shall always apply regardless of your decision to terminate your usage. My Fit Pod reserves the right to determine final prevailing pricing.",
  },
  {
    type: "paragraph",
    text: "You do hereby agree that you shall be charged fees based on the length of time of your booking of the My Fit Pod, regardless if you only make use of the My Fit Pod for less than your booked time. If you exceed the amount of time for which you booked a My Fit Pod, then you shall be charged for such excess time, as well as an overage charge if such excess time conflicts with another users booked time. You do hereby consent to such excess time charges and to such overage charge.",
  },
  {
    type: "paragraph",
    text: "My Fit Pod may make promotional offers to any of our customers. These promotional offers, unless made to you, shall have no bearing whatsoever on your offer or contract. My Fit Pod may change the fees for the Website, Mobile Application or Network at our sole discretion. We encourage you to check back at our Website and/or Mobile Application periodically to find out about how we charge for the Website, Mobile Application and Network. You can find out more information below Clause 21.",
  },
  {
    type: "paragraph",
    text: "If a credit card charge is declined, we will notify you to provide a valid replacement. Failure to provide a replacement within 48 hours may result in the suspension of your rights from accessing the Network. If a payment is declined, refunded, cancelled or charged back by your issuing bank, or another person, you are not entitled to the return of any associated service fees, such as payment processing fees, irrespective of the reason for such decline, refund, cancellation or charge back. My Fit Pod reserves the right with sole discretion to review and refuse a payment or the processing of a payment if it suspects any fraudulent activity or any other reason without limit. If you access the Website via your mobile e.g. through the Mobile Application, please be aware that your carrier's normal rates will still apply.",
  },

  { type: "subheading", text: "8. MEMBERSHIPS" },
  {
    type: "paragraph",
    text: "Your Membership subscription payment will be renewed on the same date and time of each month. This monthly date will coincide with the original date and time you purchased your Membership and will continue to reoccur unless otherwise cancelled by My Fit Pod or the individual. To change your renewal date, you must contact hello@myfitpod.co.uk",
  },
  {
    type: "paragraph",
    text: "From time to time we may need to increase the price of our Membership. We will give you at least 1 full months' notice of any incoming price increase and will make it very clear when the price increase will take effect and how much your subscription will cost after the increase. During this period, you will have your usual right to terminate your Account in accordance with the Terms. If you do not terminate the Membership by the date given to you in the notice, then the price of your Membership will be increased in accordance with our notice.",
  },

  { type: "subheading", text: "9. CANCELLATION POLICY" },
  { type: "subheading", text: "Cancellations by you" },
  {
    type: "paragraph",
    text: "Application. You can cancel your session via the 'SCHEDULED SESSIONS' tab in the app menu, subject to the below policy. Due to the nature of our business model, we require a cancellation procedure to be in place to maintain a fair system and prevent empty bookings due to late cancellations. Dependent on what method you use to book your session will depend on the Cancellation Policy that is applied.",
  },
  { type: "subheading", text: "Packages" },
  {
    type: "paragraph",
    text: "If you've paid using Packages, you will have 4 hours before your session to cancel. Your Credits will be returned immediately to your Account if these Terms are satisfied. If these Terms are not satisfied, Credits will be taken, and no refund will be given.",
  },
  { type: "subheading", text: "Pay-as-you-go" },
  {
    type: "paragraph",
    text: "If you've paid using pay-as-you-go, you will have 8 hours before your session to cancel. We will not charge your card if these Terms are satisfied. If these Terms are not satisfied, payment will be taken, and no refund will be given.",
  },
  { type: "subheading", text: "Membership" },
  {
    type: "paragraph",
    text: "If you have one of our memberships, you will have 4 hours before your session to cancel. We will not charge your card if these Terms are satisfied. If these Terms are not satisfied, payment of £5.00 late cancellation fee will be taken.",
  },
  { type: "subheading", text: "Cancellations by us" },
  {
    type: "paragraph",
    text: "We may cancel your session subject to a force majeure or similar making it impossible or significantly impede us to carry out the service.",
  },

  { type: "subheading", text: "10. LICENSING, RESTRICTIONS AND COPYRIGHT" },
  {
    type: "paragraph",
    text: "Subject to your compliance with these Terms, My Fit Pod grants you a limited, non-exclusive, non-transferable and revocable license to use My Fit Pod. Should you choose to download content from My Fit Pod, you must do so in accordance with these Terms. Such content is provided to you for its intended purposes only and always remains the property of My Fit Pod.",
  },
  {
    type: "paragraph",
    text: "You will not use, copy, adapt, decompile, modify, reverse engineer, prepare, derivative works from, distribute, license, sell, transfer, publicly display, publicly perform, transmit, stream, broadcast or otherwise exploit the Website, Mobile Application, Network or any content, except as expressly permitted under these Terms.",
  },

  { type: "subheading", text: "11. USER CONTENT" },
  {
    type: "paragraph",
    text: 'My Fit Pod may, in its sole discretion, permit users of the Network to post, upload, publish, submit or transmit content. You are solely responsible for all content that you upload, email, post or otherwise transmit including documents, text, graphics, video, messages, forum postings, your profile information, comments, questions, other materials ("User Content").',
  },
  {
    type: "paragraph",
    text: "By making available any User Content on or through the Website, Mobile Application and/or Network, you hereby grant to My Fit Pod a worldwide, irrevocable, perpetual, non-exclusive, transferable, royalty-free license, sub-licensable and transferable right, to use, view, copy, adapt, modify, distribute, license, sell, transfer, publicly display, publicly perform, transit, stream, broadcast and otherwise exploit such User Content including but without limitation through or by means of the Website, Mobile Application and/or Network. In connection, you hereby renounce and waive in favour of My Fit Pod any moral rights you have or might have, now or in the future, with respect to User Content. Nothing in these Terms will be deemed to restrict any rights that you have may to use and exploit any User Content. You also hereby represent and warrant that you have the right to grant us the right over your User Content and that you will indemnify us for any loss resulting from a breach of this warranty and defend us against claims resulting from the same.",
  },
  {
    type: "paragraph",
    text: "You acknowledge and agree that you are solely responsible for all User Content that you make available through the Website, Mobile Application and/or Network. Accordingly, you represent and warrant that you either are the sole and exclusive owner of all User Content that you make available through the Website, Mobile Application and/or Network or you have all rights, licenses, consents and releases that are necessary to grant to My Fit Pod the rights in such User Content, as contemplated under this agreement and neither the User Content nor your posting, uploading, publication, submission or transmittal of the User Content or My Fit Pod's use of the User Content or any portion therefore will infringe, misappropriate or violate a third-party patent, copyright, trademark, trade secret, moral rights or other intellectual property rights or rights of publicity or privacy or result in the violation of any applicable law or regulation.",
  },

  { type: "subheading", text: "12. INTELLECTUAL PROPERTY" },
  {
    type: "paragraph",
    text: 'References in these conditions to Intellectual Property rights, the ("IP") means copyright, patents, rights in inventions, rights in confidential information, know-how, trade secrets, trademarks, service marks, trade names, design rights, rights in get-up, database rights, rights in data, domain names, rights in computer software (including source code and object code) and all similar rights of whatever nature and in each case, whether registered or not, including any applications to protect or register such rights, including all renewals and extensions of such rights or application, whether vested, contingent or future and wherever in the world they exist.',
  },
  {
    type: "paragraph",
    text: "Unless specifically indicated otherwise, the Website, Mobile Application and/or Network together with all IP rights are owned by My Fit Pod, our licensors or both (as applicable). Such IP rights are protected by copyright laws and treaties around the world. We and our licensors reserve all of our and their rights in any such IP rights in connection with these conditions. This means that we and they remain owners of them and free to use them as we and they see fit.",
  },
  {
    type: "paragraph",
    text: "The Website, Mobile Application and/or Network are for intended uses only and nothing in these conditions grant you any legal rights to access or use the Website, Mobile Application and/or Network for any other purposes. You may not use the Website, Mobile Application and/or Network for any further or additional uses and in particular may not reproduce or otherwise make available the same in whole or in part, without the prior written consent of My Fit Pod or our licensors, if applicable. In addition, none of the content or design on the Website, Mobile Application and Network may be copied, altered in any way or transmitted or distributed to any other party without our prior express written permission.",
  },
  {
    type: "paragraph",
    text: 'You retain ownership of any information or data you provide to or through the Site ("User Data"). Subject to foregoing, by using the Website, Mobile Application and/or Network, you are granting My Fit Pod a non-exclusive, perpetual, irrevocable, royalty free, transferable license to copy, reproduce, remove, process, adapt, transmit, save, host, display and otherwise use your User Data in accordance with our Privacy Policy which can be found in the headline of these Terms and in Clause 26.',
  },
  {
    type: "paragraph",
    text: 'We reserve the right to remove any User Data that in our sole discretion deem inappropriate, abusive, unlawful or otherwise contrary to, or in breach of, these Terms or the proper use of the Website, Mobile Application and/or Network ("Infringing User Data"). My Fit Pod shall not be responsible or liable to any third-party in respect of any Infringing User Data.',
  },

  { type: "subheading", text: "13. APPLICATION LICENSE" },
  {
    type: "paragraph",
    text: "Subject to your compliance with these Terms, My Fit Pod grants you a limited, non-exclusive, non-sublicensable, revocable, non-transferable license to: (i) access and use the Mobile Application on your personal device solely in connection with your use of My Fit Pod; and (ii) access and use any content, information and related materials that may be made available through My Fit Pod, in each case solely for your personal, non-commercial use. Any rights not expressly granted herein are reserved by My Fit Pod and My Fit Pod's licensors.",
  },

  { type: "subheading", text: "14. SMS MESSAGING" },
  {
    type: "paragraph",
    text: "You agree that My Fit Pod may contact you by telephone or text messages (including by an automatic telephone dialling system) at any of the phone numbers provided by you or on your behalf in connection with an Account, including for marketing purposes. You understand that you are not required to provide this consent as a condition of purchasing anything from the Website, Mobile Application or Network. You also understand that you may opt out of receiving text messages from My Fit Pod at any time. If you do not choose to opt out, My Fit Pod may contact you as outlined in our Privacy Policy which can be found in the headline of these Terms and in Clause 26.",
  },

  { type: "subheading", text: "15. THIRD-PARTY SERVICES" },
  {
    type: "paragraph",
    text: "During use of the Website, Mobile Application and Network, you may enter into correspondence with, purchase goods and/or services from, or participate in promotions of third-party service providers, advertisers, sponsors or affiliates showing their goods and/or services through the Website, Mobile Application or Network. Any such activity and any Terms, conditions, warranties or representations associated with such activity is solely between you and the applicable third-party. My Fit Pod and its licensors shall have no liability, obligation or responsibility for any such correspondence, purchase, transaction, services or promotion between you and any such third-party. My Fit Pod does not endorse any sites on the internet that are linked through the Website, Mobile Application or Network and in no event shall My Fit Pod or its licensors be responsible for any content, products, services or other materials on or available from such sites or third-party providers.",
  },
  {
    type: "paragraph",
    text: "My Fit Pod may rely on third-party advertising and marketing supplied through the Website, Mobile Application and Network and any other mechanisms to subsidise the Website, Mobile Application or Network. By agreeing to these Terms, you agree to receive such advertising and marketing. If you do not want to receive such advertising, you must notify us at hello@myfitpod.co.uk. My Fit Pod reserves the right to charge you a higher fee for the Website, Mobile Application and Network should you choose not to receive this advertising services.",
  },

  { type: "subheading", text: "16. INDEMNITY" },
  {
    type: "paragraph",
    text: "You agree to release, defend, indemnify and hold harmless My Fit Pod, our Landlords and/or our Managing Agents and their respectable officers, directors, agents, subsidiaries, joint ventures, employees and third-party service providers, from all claims, demands, losses, liabilities, costs, expenses, obligations and damages of every kind and nature, known and unknown, including reasonable legal fees arising out of your use and access to the Website, Mobile Application and Network, your violation of any term of these Terms, your violation of any law or the rights of a third-party including without limitation, any copyright, property or privacy right, or any claim that any content you submitted caused damage to a third-party. You agree to notify My Fit Pod and in writing at hello@myfitpod.co.uk of such claim.",
  },

  { type: "subheading", text: "17. DISCLAIMER" },
  {
    type: "paragraph",
    text: 'My Fit Pod provides the Website, Mobile Application and Network along with its content, materials, information, software and products included therein including separate services performed by third parties under control for use on an "as if", "where is" and "as available" basis. To the maximum extent permitted by law, My Fit Pod disclaims all representations and warranties whether express or implied with respect to My Fit Pod including without limitation; any warranties or merchantability and fitness for a particular purpose, features, quality, non-infringement, title, performance, compatibility, security or accuracy and that the quality of the My Fit Pod as well as any products, service, information or other material purchased or obtained by you through the Website, Mobile Application or Network will meet your requirements or expectations. You acknowledge and agree that the entire risk arising out of your use of My Fit Pod and/or third-party services or products remains solely with you to the maximum extent permitted by law.',
  },
  {
    type: "paragraph",
    text: "You hereby acknowledge and agree that; the locking mechanism used on the My Fit Pod is provided by a third-party and My Fit Pod, the Landlord and/or the Managing Agent have no liability whatsoever with respect to any failure of the locking system to work in its intended manner including without limitation any loss or theft of your property as the Network is located in buildings which are not owned, managed or manned by My Fit Pod and My Fit Pod makes no representations or warranties relating thereto.",
  },
  {
    type: "paragraph",
    text: "Additionally, My Fit Pod, the Landlord and/or the Managing Agent make no representation or warranty with respect to the suitability of the Network for any particular activity and shall not be liable in anyway for such activities. My Fit Pod, the Landlord and/or the Managing Agent does not warrant that the My Fit Pod will operate in an uninterrupted or error-free manner or that My Fit Pod will always be available or free from all harmful components or that it is safe, secured from unauthorised access, immune from damages, free of malfunctions, bugs or failures, including, but not limited to hardware failures, originating either from My Fit Pod or its providers.",
  },

  { type: "subheading", text: "18. WAIVER" },
  {
    type: "paragraph",
    text: "I declare that I intend to use some or all of the activities, facilities and services offered by My Fit Pod and I understand that each person (including myself), has different skill levels for participating in such activity. I assume full responsibility during and after my participation at My Fit Pod and for my choices to use or apply, at my own risk, any portion of the equipment, facilities, information or instruction available.",
  },
  {
    type: "paragraph",
    text: "I understand that part of the risk involved in undertaking exercise is relative to my own state of fitness or health (physical and emotionally) and the awareness, care and skill in which I conduct myself in any usage of My Fit Pod.",
  },
  {
    type: "paragraph",
    text: "I agree that to the best of my knowledge and belief I am in good health and not knowingly incapable of engaging in either active or passive exercise and that such exercise would not be detrimental to my health, safety, comfort, wellbeing or physical condition.",
  },
  {
    type: "paragraph",
    text: "In addition, I understand that I should immediately withdraw from, reduce or modify my involvement in any of the activities and I should do so on recognition of any signs of physical discomfort which may include: lightheadedness, fainting, chest discomfort, leg cramps, nausea, etc.",
  },
  {
    type: "paragraph",
    text: "I further understand that there are possible risks involved in participating in exercise and My Fit Pod will accept no responsibility for my actions, injuries or health during my use of My Fit Pod.",
  },
  {
    type: "paragraph",
    text: 'If you start to feel unwell or a life threatening emergency occurs in a My Fit Pod facility, you should immediately call the Emergency Services by dialling 999 (or the relevant country code) on your phone and you should press the allocated "Emergency Button" to notify My Fit Pod so we can take necessary action.',
  },

  { type: "subheading", text: "19. LIMITATION OF LIABILITY" },
  {
    type: "paragraph",
    text: "My Fit Pod, it's Officers, Directors, Shareholders, Employees, Suppliers, Sub-Contractors, Agents, Landlords and Managing Agents will not be liable for any direct, indirect, incidental, consequential or any other damage or loss including loss of profit and loss of data, costs, expenses and payments, arising from or in connection with the use or inability to use the services of My Fit Pod.",
  },
  {
    type: "paragraph",
    text: "Responsibility for the decisions you make regarding My Fit Pod offered via the Website, Mobile Application or Network with all its implications rest solely with you. My Fit Pod will not assess the suitability, legality or ability of any such building owners or other third parties and you expressly waive and release My Fit Pod and building owners, to the maximum extent, allowable under applicable law, from any and all liability, claims, causes of action or damages arising from your use of the Website, Mobile Application or Network and/or in any way related to the third parties introduced to you by My Fit Pod.",
  },
  {
    type: "paragraph",
    text: "The quality of the building in which My Fit Pod are located are entirely the responsibility of the Landlord and/or Managing Agent. You understand that by using My Fit Pod you may be exposed to locations that are potentially dangerous, offensive, harmful to minors, unsafe or otherwise objectionable and that you use My Fit Pod at your own risk.",
  },
  {
    type: "paragraph",
    text: "To the extend applicable under local law, nothing in this agreement shall limit the liability for death or personal injury caused by negligence from My Fit Pod or for fraud or fraudulent misrepresentation.",
  },

  { type: "subheading", text: "20. FACILITY RATING SYSTEM" },
  {
    type: "paragraph",
    text: "You may be required to rate certain aspects of your overall experience with My Fit Pod as well as certain aspects e.g. other users. This rating will be prompted through the Website and/or Mobile Application. If you do not participate when requested, My Fit Pod reserves the right (without limiting any of My Fit Pod's other rights hereunder) to restrict your access to My Fit Pod.",
  },

  { type: "subheading", text: "21. PROMOTION TERMS" },
  {
    type: "paragraph",
    text: "My Fit Pod reserves the right to end any promotion without warning at any time. Any prizes offered by My Fit Pod must be claimed within 21 days of announcement of the winners. My Fit Pod have 45 days to issue any prize. All My Fit Pod challenges are subject to fair play. My Fit Pod reserve the right to redeem any prize in the form of a voucher or pre-purchased credit.",
  },

  { type: "subheading", text: "22. NOTICES" },
  {
    type: "paragraph",
    text: "My Fit Pod may send you notices by means of email to your email address on record in your Account. You may give notice, and address any complaint or claim to My Fit Pod (such notice, complaint or claim shall be deemed given when received by My Fit Pod) at any time by means of email to hello@myfitpod.co.uk",
  },

  { type: "subheading", text: "23. GOVERNING LAW" },
  {
    type: "paragraph",
    text: "These conditions, their subject matter and formation, are governed by the laws of England and Wales. You and we both agree that the courts of England and Wales will have exclusion jurisdiction. However, if you are a resident in Northern Ireland, you may also bring proceedings in Northern Ireland and if you are a resident of Scotland, you may also bring proceedings in Scotland.",
  },

  { type: "subheading", text: "24. TERMINATION" },
  {
    type: "paragraph",
    text: "You agree that My Fit Pod, in its sole discretion and for any or no reason, may terminate any Account (or any part thereof) you may have with My Fit Pod or your use of My Fit Pod, and remove and discard all or any part of your Account or any of your User Content, at any time.",
  },
  {
    type: "paragraph",
    text: "You may terminate your Account at any time by ceasing all use of the Website, deleting the Mobile Application from your device and no longer partaking in any sessions in the Network. Furthermore, you may request My Fit Pod to cancel your Account via email sent to hello@myfitpod.co.uk subject to contract.",
  },

  { type: "subheading", text: "25. GENERAL" },
  {
    type: "paragraph",
    text: "No joint venture, partnership, employment, or agency relationship exists between you, My Fit Pod or any third-party provider as a result of these Terms or use of the Website, Mobile Application and Network. These Terms may not be assigned by you, whether in whole or in part, without the prior written approval of My Fit Pod. If any provision is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall fully be enforced under law. These Terms comprise the entire agreement between you and My Fit Pod and supersedes all prior or contemporaneous negotiations, discussions or agreements, whether written or oral, between the parties regarding the subject matter contained herein.",
  },
];
