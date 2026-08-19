import { Hr, Section, Text } from "@react-email/components";

export default function EmailSignature({ text }: { text: string }) {
  if (!text.trim()) return null;
  const lines = text.split(/\r?\n/);

  return (
    <Section>
      <Hr
        style={{
          borderColor: "#e8e2d4",
          marginTop: 24,
          marginBottom: 20,
          width: 56,
        }}
      />
      {lines.map((line, i) => (
        <Text
          key={i}
          style={{
            margin: "0",
            padding: "0",
            fontSize: 13,
            lineHeight: "1.7",
            color: "#3d3830",
          }}
        >
          {line || "\u00a0"}
        </Text>
      ))}
    </Section>
  );
}